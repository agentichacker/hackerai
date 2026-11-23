#!/usr/bin/env node
// @effect-diagnostics nodeBuiltinImport:off globalConsole:off globalDate:off globalFetch:off - Host-side launch automation polls an installed app with Node timing and HTTP APIs directly.
// Launches an installed desktop app against an empty HackerAI home, as a fresh install does, and
// checks that its backend publishes a ready runtime and its renderer gets past the splash screen.
// The window is captured so the first screen a new user sees can be reviewed.
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeTimersPromises from "node:timers/promises";
import * as NodeUtil from "node:util";
import { _electron, type ElectronApplication, type Page } from "playwright-core";

const STEP_TIMEOUT_MS = 90_000;
// Onboarding keeps animating, so a network-idle wait never settles; give it fixed time to paint.
const SETTLE_MS = 8_000;

const { values } = NodeUtil.parseArgs({
  options: {
    executable: { type: "string" },
    // An unpackaged app directory for a plain Electron executable, as PR CI runs it.
    app: { type: "string" },
    "artifacts-dir": { type: "string" },
  },
});
const executable = values.executable;
if (!executable)
  throw new Error(
    "Usage: smoke-desktop-first-run.ts --executable <app> [--app <dir>] [--artifacts-dir <dir>]",
  );
const artifactsDir = NodePath.resolve(values["artifacts-dir"] ?? "desktop-first-run-check");

const home = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "hackerai-desktop-first-run-"));
const stateDir = NodePath.join(home, "hackerai", "userdata");
const runtimePath = NodePath.join(stateDir, "server-runtime.json");

// The server publishes its runtime record once its HTTP listener answers.
const waitForBackend = async () => {
  const deadline = Date.now() + STEP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const runtime = JSON.parse(NodeFS.readFileSync(runtimePath, "utf8")) as { port?: unknown };
      if (typeof runtime.port === "number") {
        const response = await fetch(`http://127.0.0.1:${runtime.port}/`, {
          signal: AbortSignal.timeout(5_000),
        });
        await response.body?.cancel();
        return { port: runtime.port, status: response.status };
      }
    } catch {
      // Nothing is published or answering yet.
    }
    await NodeTimersPromises.setTimeout(500);
  }
  throw new Error(`The backend did not publish ${runtimePath} with an answering HTTP port.`);
};

const collectLogs = () => {
  const logs = NodePath.join(stateDir, "logs");
  if (!NodeFS.existsSync(logs)) return [];
  NodeFS.mkdirSync(artifactsDir, { recursive: true });
  NodeFS.cpSync(logs, NodePath.join(artifactsDir, "logs"), { recursive: true });
  return NodeFS.readdirSync(logs)
    .filter((name) => name.endsWith(".log"))
    .flatMap((name) => NodeFS.readFileSync(NodePath.join(logs, name), "utf8").split("\n"));
};

let step = "launching the app";
let app: ElectronApplication | undefined;
let page: Page | undefined;
const pageErrors: string[] = [];
try {
  app = await _electron.launch({
    executablePath: executable,
    args: [...(values.app ? [NodePath.resolve(values.app)] : []), "--no-sandbox"],
    // Unlike the release launch check, the updater stays on: a fresh install checks for updates.
    env: {
      ...process.env,
      HACKERAI_HOME: NodePath.join(home, "hackerai"),
      HACKERAI_TELEMETRY_ENABLED: "false",
    },
    timeout: STEP_TIMEOUT_MS,
  });
  // A backend that never starts leaves no window, or only the "could not start" window.
  step = "waiting for the first window";
  page = await app.firstWindow({ timeout: STEP_TIMEOUT_MS });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  step = "waiting for the backend";
  const backend = await waitForBackend();
  console.log(
    `Backend ready on port ${String(backend.port)} (GET / answered ${String(backend.status)}).`,
  );

  step = "waiting for the renderer to replace its splash screen";
  await page.waitForFunction(() => document.getElementById("boot-shell") === null, undefined, {
    timeout: STEP_TIMEOUT_MS,
  });
  await page.waitForTimeout(SETTLE_MS);

  step = "capturing the first window";
  NodeFS.mkdirSync(artifactsDir, { recursive: true });
  await page.screenshot({ path: NodePath.join(artifactsDir, "first-run.png") });
  for (const window of app.windows()) {
    const [url, title] = await Promise.all([window.url(), window.title()]);
    console.log(`Window: ${url} "${title}"`);
  }
  if (pageErrors.length > 0) throw new Error(`Uncaught renderer errors: ${pageErrors.join(" | ")}`);
  console.log("Desktop first-run check passed: the backend started and the app rendered.");
} catch (error) {
  console.error(`Desktop first-run check failed while ${step}.`);
  console.error(error instanceof Error ? error.message : error);
  if (page && !page.isClosed()) {
    NodeFS.mkdirSync(artifactsDir, { recursive: true });
    await page
      .screenshot({ path: NodePath.join(artifactsDir, "failed.png"), timeout: 10_000 })
      .catch(() => {});
  }
  process.exitCode = 1;
} finally {
  const logLines = collectLogs();
  if (logLines.length > 0) {
    const notable = logLines.filter((line) => /updat|error|warn/i.test(line)).slice(-40);
    if (notable.length > 0) {
      console.error("\nNotable log lines (update, error, warning):");
      console.error(notable.join("\n"));
    }
  }
  if (app) {
    // A hung app never finishes closing; kill it so the job does not wait for its timeout.
    // Playwright drops the process handle once the app closes, so read it first.
    const child = app.process();
    const closed = app.close().catch(() => {});
    await Promise.race([closed, NodeTimersPromises.setTimeout(10_000, undefined, { ref: false })]);
    child.kill("SIGKILL");
  }
  try {
    NodeFS.rmSync(home, { recursive: true, force: true, maxRetries: 5 });
  } catch {
    // A process the app left behind can still hold a file open; the runner is discarded anyway.
  }
}
