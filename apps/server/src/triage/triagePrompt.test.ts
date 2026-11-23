// @effect-diagnostics nodeBuiltinImport:off
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

import { assert, it } from "@effect/vitest";

import {
  buildTriageContext,
  buildTriageLaunchPrompt,
  type TriageContextInput,
  TRIAGE_PLAYBOOK,
} from "./triagePrompt.ts";

it("stays byte-identical to .github/triage/PLAYBOOK.md", () => {
  // Older releases fetch the repository playbook.
  const canonicalPath = NodePath.join(
    import.meta.dirname,
    "../../../../.github/triage/PLAYBOOK.md",
  );
  assert.equal(TRIAGE_PLAYBOOK, NodeFS.readFileSync(canonicalPath, "utf8"));
});

it("launch prompt stays a single argv-safe line naming the prompt file", () => {
  // Windows .cmd shims cannot carry multiline argv.
  const launch = buildTriageLaunchPrompt(String.raw`C:\Users\a b\.hackerai\userdata\triage\x\prompt.md`);
  assert.notInclude(launch, "\n");
  assert.include(launch, String.raw`C:\Users\a b\.hackerai\userdata\triage\x\prompt.md`);
  assert.isBelow(launch.length, 1_000);
});

it("context file labels the CLI version as the CLI's, not the user's build", () => {
  const context = buildTriageContext({
    ...contextInput,
    entry: { kind: "cli", cliVersion: "0.0.42", launchedAs: "npx @hackerai/cli triage" },
    server: "running (pid 42, http://127.0.0.1:3773, version 0.0.43-nightly.20260923.2173)",
  });
  assert.notInclude(context, "Installed version");
  assert.notInclude(context, "Release tag");
  assert.include(context, "- Triage CLI version: 0.0.42 (");
  assert.include(context, "version 0.0.43-nightly.20260923.2173");
  assert.notInclude(context, "runs inside HackerAI");
});

it("in-app context warns the agent off its own server and points at the clone in progress", () => {
  const context = buildTriageContext({
    ...contextInput,
    entry: { kind: "app", client: "HackerAI Desktop version 0.1.1 on macos" },
    server: "running (pid 42, version 0.1.1); this session runs inside it",
    sourceClone: {
      _tag: "cloning",
      directory: "/home/u/.hackerai/source/abc123",
      ref: "v0.1.1",
      commit: "abc123",
      serverVersion: "0.1.1",
    },
  });
  assert.notInclude(context, "Triage CLI version");
  assert.include(context, "- Started from: HackerAI Desktop version 0.1.1 on macos (");
  assert.include(context, "## This session runs inside HackerAI");
  assert.include(context, "/home/u/.hackerai/source/abc123  (v0.1.1, commit abc123)");
  assert.include(context, "Wait for it instead of\ncloning again.");
});

const contextInput = {
  generatedAt: "2026-09-24T00:00:00.000Z",
  os: "linux x64 (7.2.0)",
  nodeVersion: "v26.8.2",
  paths: {
    stateDir: "/home/u/.hackerai/userdata",
    dbPath: "/home/u/.hackerai/userdata/state.sqlite",
    settingsPath: "/home/u/.hackerai/userdata/settings.json",
    logsDir: "/home/u/.hackerai/userdata/logs",
    serviceLogPath: "/home/u/.hackerai/userdata/logs/boot-service.log",
    desktopBackendLogGlob: "/home/u/.hackerai/userdata/logs/server-child*.log*",
    relayClientLogPath: "/home/u/.hackerai/userdata/logs/relay-client.ndjson",
    serverTracePath: "/home/u/.hackerai/userdata/logs/server.trace.ndjson",
    providerEventLogPath: "/home/u/.hackerai/userdata/logs/provider/events.log",
    terminalLogsDir: "/home/u/.hackerai/userdata/logs/terminals",
    providerStatusCacheDir: "/home/u/.hackerai/caches",
    secretsDir: "/home/u/.hackerai/userdata/secrets",
    sourceCacheDir: "/home/u/.hackerai/source",
  },
} satisfies Omit<TriageContextInput, "entry" | "server">;
