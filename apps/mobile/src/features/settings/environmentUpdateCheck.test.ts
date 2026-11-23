import { EnvironmentId } from "@hackerai/contracts";
import { AtomRegistry } from "effect/reactivity";
import { describe, expect, it, vi } from "vite-plus/test";

import { environmentReleaseCheckAtom, releaseCheckError } from "./environmentUpdateCheck";

// The real package loads React Native, which the unit runner cannot parse.
vi.mock("expo-constants", () => ({
  default: { expoConfig: { version: "2.3.0", extra: { releaseRepository: "example/hackerai" } } },
}));

function stubHangingFetch() {
  const { promise: called, resolve } = Promise.withResolvers<AbortSignal>();
  vi.stubGlobal("fetch", (_url: string, init: { signal: AbortSignal }) => {
    resolve(init.signal);
    return new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(init.signal.reason));
    });
  });
  return { called, [Symbol.dispose]: () => vi.unstubAllGlobals() };
}

function makeRegistry() {
  const tasks: Array<() => void> = [];
  const registry = AtomRegistry.make({
    scheduleTask: (task) => {
      tasks.push(task);
      return () => undefined;
    },
  });
  const flush = () => {
    for (let task = tasks.shift(); task !== undefined; task = tasks.shift()) task();
  };
  return { registry, flush };
}

describe("environmentReleaseCheckAtom", () => {
  it("aborts the release lookup when the screen stops reading it", async () => {
    using fetchStub = stubHangingFetch();
    const { registry, flush } = makeRegistry();
    const atom = environmentReleaseCheckAtom(EnvironmentId.make("env-unmount"));
    const unmount = registry.mount(atom);

    registry.set(atom, async () => "0.0.40");
    const signal = await fetchStub.called;
    expect(signal.aborted).toBe(false);

    unmount();
    flush();
    expect(signal.aborted).toBe(true);
  });

  it("reports a timeout in words after 20 seconds", async () => {
    using fetchStub = stubHangingFetch();
    using _timers = { [Symbol.dispose]: () => vi.useRealTimers() };
    vi.useFakeTimers();
    const { registry, flush } = makeRegistry();
    const atom = environmentReleaseCheckAtom(EnvironmentId.make("env-timeout"));
    const unmount = registry.mount(atom);

    registry.set(atom, async () => "0.0.40");
    const signal = await fetchStub.called;

    await vi.advanceTimersByTimeAsync(20_000);
    expect(signal.aborted).toBe(true);
    expect(releaseCheckError(registry.get(atom))).toBe(
      "Checking for updates timed out. Try again.",
    );
    unmount();
    flush();
  });
});
