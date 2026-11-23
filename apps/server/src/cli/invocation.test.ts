import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import * as HostProcess from "@hackerai/shared/HostProcess";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";

import packageJson from "../../package.json" with { type: "json" };
import { posixLauncherScript } from "../cloud/pinnedRuntime.ts";
import {
  resolveHostCliCommand,
  resolveRootCliCommand,
  resolveServerInstallation,
} from "./invocation.ts";

it.layer(NodeServices.layer)("root CLI commands", (it) => {
  const rootCommand = (input: {
    readonly node: string;
    readonly entry: string;
    readonly path?: string;
    readonly env?: Record<string, string>;
    readonly executable?: boolean;
    readonly args?: ReadonlyArray<string>;
    readonly platform?: NodeJS.Platform;
  }) =>
    resolveRootCliCommand("browser setup", input.args).pipe(
      Effect.provideService(HostProcess.ExecutablePath, input.node),
      Effect.provideService(HostProcess.Arguments, [input.node, input.entry]),
      Effect.provideService(HostProcess.IsExecutable, input.executable ?? false),
      Effect.provideService(HostProcess.Platform, input.platform ?? "linux"),
      Effect.provideService(HostProcess.Environment, { PATH: input.path ?? "", ...input.env }),
    );

  const pathWithHackerAI = Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const bin = yield* fs.makeTempDirectoryScoped();
    yield* fs.writeFileString(path.join(bin, "hackerai"), "#!/bin/sh\n", { mode: 0o755 });
    return bin;
  });

  it.effect("keeps a user-installed Node reachable when the command runs under sudo", () =>
    Effect.gen(function* () {
      const npx = "/home/theo/.npm/_npx/abc/node_modules/hackerai/dist/bin.mjs";
      expect(yield* rootCommand({ node: "/usr/bin/node", entry: npx })).toBe(
        "sudo npx @hackerai/cli browser setup",
      );
      expect(
        yield* rootCommand({ node: "/home/theo/.nvm/versions/node/v24/bin/node", entry: npx }),
      ).toBe('sudo env "PATH=$PATH" npx @hackerai/cli browser setup');
      expect(
        yield* rootCommand({
          node: "/home/theo/.local/node/bin/node",
          entry: "/home/theo/.local/lib/node_modules/@hackerai/cli/dist/bin.mjs",
          path: yield* pathWithHackerAI,
        }),
      ).toBe('sudo env "PATH=$PATH" hackerai browser setup');
    }),
  );

  it.effect("does not prefix the setup hint with sudo on Windows", () =>
    Effect.gen(function* () {
      expect(
        yield* rootCommand({
          node: "C:\\Program Files\\nodejs\\node.exe",
          entry: "C:\\Users\\theo\\npm\\_npx\\abc\\node_modules\\hackerai\\dist\\bin.mjs",
          platform: "win32",
        }),
      ).toBe("npx @hackerai/cli browser setup");
    }),
  );

  it.effect("keeps the arguments, so root runs setup on the same HackerAI home", () =>
    Effect.gen(function* () {
      const args = ["--base-dir", "/srv/hackerai home"];
      expect(
        yield* rootCommand({
          node: "/home/theo/.local/node/bin/node",
          entry: "/home/theo/.local/lib/node_modules/@hackerai/cli/dist/bin.mjs",
          path: yield* pathWithHackerAI,
          args,
        }),
      ).toBe(`sudo env "PATH=$PATH" hackerai browser setup --base-dir '/srv/hackerai home'`);
      expect(
        yield* rootCommand({
          node: "/opt/hackerai/hackerai",
          entry: "/opt/hackerai/hackerai",
          executable: true,
          args,
        }),
      ).toBe("sudo /opt/hackerai/hackerai browser setup --base-dir '/srv/hackerai home'");
    }),
  );

  it.effect("names this install's launcher when hackerai is not on PATH", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const home = yield* fs.makeTempDirectoryScoped();
      const shim = path.join(home, ".local bin", "hackerai");
      yield* fs.makeDirectory(path.dirname(shim), { recursive: true });
      yield* fs.writeFileString(shim, "#!/bin/sh\n", { mode: 0o755 });
      const desktop = {
        node: "/tmp/.mount_HackerAIabc/hackerai",
        entry: "/tmp/.mount_HackerAIabc/resources/app.asar/apps/server/dist/bin.mjs",
        env: { HACKERAI_CLI_PATH: shim },
      };

      expect(yield* rootCommand(desktop)).toBe(`sudo '${shim}' browser setup`);

      // An unrelated `hackerai` on PATH, such as an older npm global, is another install's CLI.
      expect(yield* rootCommand({ ...desktop, path: yield* pathWithHackerAI })).toBe(
        `sudo '${shim}' browser setup`,
      );

      // The link the app installs onto PATH leads to its own launcher, so plain `hackerai` is right.
      const linked = yield* fs.makeTempDirectoryScoped();
      yield* fs.symlink(shim, path.join(linked, "hackerai"));
      expect(yield* rootCommand({ ...desktop, path: linked })).toBe(
        'sudo env "PATH=$PATH" hackerai browser setup',
      );

      expect(
        yield* rootCommand({
          node: "/opt/hackerai/hackerai",
          entry: "/opt/hackerai/hackerai",
          executable: true,
        }),
      ).toBe("sudo /opt/hackerai/hackerai browser setup");

      // A standalone executable started directly (systemd, no launcher) is still this install.
      expect(
        yield* rootCommand({
          node: "/opt/hackerai/hackerai",
          entry: "/opt/hackerai/hackerai",
          executable: true,
          path: yield* pathWithHackerAI,
        }),
      ).toBe("sudo /opt/hackerai/hackerai browser setup");

      // A global npm launcher runs the downloaded executable; PATH's `hackerai` is that launcher.
      const prefix = path.join(home, "npm");
      const npmLauncher = path.join(prefix, "lib/node_modules/@hackerai/cli/bin/hackerai.mjs");
      yield* fs.makeDirectory(path.dirname(npmLauncher), { recursive: true });
      yield* fs.makeDirectory(path.join(prefix, "bin"));
      yield* fs.writeFileString(npmLauncher, "", { mode: 0o755 });
      yield* fs.writeFileString(
        path.join(prefix, "lib/node_modules/@hackerai/cli/package.json"),
        `{"name":"@hackerai/cli","version":"${packageJson.version}"}`,
      );
      yield* fs.symlink(npmLauncher, path.join(prefix, "bin/hackerai"));
      expect(
        yield* rootCommand({
          node: "/home/theo/.hackerai/runtime/versions/1.0.0/hackerai",
          entry: "/home/theo/.hackerai/runtime/versions/1.0.0/hackerai",
          executable: true,
          path: path.join(prefix, "bin"),
          env: { HACKERAI_NPM_LAUNCHER_PATH: npmLauncher },
        }),
      ).toBe('sudo env "PATH=$PATH" hackerai browser setup');

      expect(
        yield* rootCommand({ ...desktop, env: { HACKERAI_CLI_PATH: path.join(home, "gone") } }),
      ).toBe('sudo env "PATH=$PATH" hackerai browser setup');
    }),
  );
});

it.layer(NodeServices.layer)("host CLI commands", (it) => {
  it.effect("renders a PowerShell command line on Windows", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const home = yield* fs.makeTempDirectoryScoped();
      const shim = path.join(home, "hackerai.cmd");
      yield* fs.writeFileString(shim, "@echo off\r\n");
      const hostCommand = (platform: NodeJS.Platform, env: Record<string, string>) =>
        resolveHostCliCommand("doctor", ["--base-dir", "C:\\Users\\Jane Doe\\.hackerai"]).pipe(
          Effect.provideService(
            HostProcess.ExecutablePath,
            "C:\\Program Files\\HackerAI\\hackerai.exe",
          ),
          Effect.provideService(HostProcess.Arguments, [
            "C:\\Program Files\\HackerAI\\hackerai.exe",
            "C:\\Program Files\\HackerAI\\resources\\app.asar\\apps\\server\\dist\\bin.mjs",
          ]),
          Effect.provideService(HostProcess.IsExecutable, false),
          Effect.provideService(HostProcess.Platform, platform),
          Effect.provideService(HostProcess.Environment, { PATH: "", ...env }),
        );
      expect((yield* hostCommand("win32", { HACKERAI_CLI_PATH: shim })).command).toBe(
        `& "${shim}" doctor "--base-dir" "C:\\Users\\Jane Doe\\.hackerai"`,
      );
      expect((yield* hostCommand("win32", {})).command).toBe(
        'hackerai doctor "--base-dir" "C:\\Users\\Jane Doe\\.hackerai"',
      );
      expect(
        (yield* resolveHostCliCommand("doctor", [
          "--base-dir",
          "C:\\HackerAI\\\u201CArchive\u201D",
        ]).pipe(
          Effect.provideService(HostProcess.Platform, "win32"),
          Effect.provideService(HostProcess.Environment, { PATH: "" }),
          Effect.provideService(HostProcess.ExecutablePath, "C:\\hackerai.exe"),
          Effect.provideService(HostProcess.Arguments, ["C:\\hackerai.exe", "C:\\bin.mjs"]),
          Effect.provideService(HostProcess.IsExecutable, false),
        )).command,
      ).toBe('hackerai doctor "--base-dir" "C:\\HackerAI\\\u201C\u201CArchive\u201D\u201D"');
      expect((yield* hostCommand("linux", { HACKERAI_CLI_PATH: shim })).command).toMatch(
        / doctor --base-dir 'C:\\Users\\Jane Doe\\\.hackerai'$/,
      );
    }),
  );
});

it.layer(NodeServices.layer)("manual server installation ownership", (it) => {
  it.effect("recognizes runner caches for script packages and the npm launcher", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped();
      const executable = path.join(root, ".hackerai/runtime/versions/1.0.0/hackerai");
      yield* fs.makeDirectory(path.dirname(executable), { recursive: true });
      yield* fs.writeFileString(executable, "");
      for (const [relative, kind] of [
        ["npm/_npx/hash/node_modules/hackerai/dist/bin.mjs", "npx"],
        ["npm/_npx/hash/node_modules/hackerai/bin/hackerai.mjs", "npx"],
        ["pnpm/dlx/hash/node_modules/hackerai/dist/bin.mjs", "pnpm-dlx"],
        [".bun/install/cache/hackerai/dist/bin.mjs", "bunx"],
      ] as const) {
        const entry = path.join(root, relative);
        yield* fs.makeDirectory(path.dirname(entry), { recursive: true });
        yield* fs.writeFileString(entry, "");
        yield* fs.writeFileString(
          path.join(path.dirname(entry), "../package.json"),
          `{"name":"@hackerai/cli","version":"${packageJson.version}","bin":{"hackerai":"./bin/hackerai.mjs"}}`,
        );
        const launchedBy = entry.endsWith("hackerai.mjs");
        const installation = yield* resolveServerInstallation.pipe(
          Effect.provideService(HostProcess.Arguments, [launchedBy ? executable : "node", entry]),
          Effect.provideService(HostProcess.ExecutablePath, executable),
          Effect.provideService(HostProcess.IsExecutable, launchedBy),
          Effect.provideService(
            HostProcess.Environment,
            launchedBy ? { HACKERAI_NPM_LAUNCHER_PATH: entry } : {},
          ),
        );
        expect(installation).toEqual({ kind });
      }
    }),
  );

  it.effect("requires the npm prefix's bin to point to the running package", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      // macOS reports /var and /private/var as different paths; the resolver compares real paths.
      const root = yield* fs.realPath(yield* fs.makeTempDirectoryScoped());
      const prefix = path.join(root, "bunx-tools");
      const packageRoot = path.join(prefix, "lib/node_modules/@hackerai/cli");
      const entry = path.join(packageRoot, "dist/bin.mjs");
      const globalBin = path.join(prefix, "bin/hackerai");
      yield* fs.makeDirectory(path.dirname(entry), { recursive: true });
      yield* fs.makeDirectory(path.dirname(globalBin), { recursive: true });
      yield* fs.writeFileString(entry, "");
      yield* fs.writeFileString(
        path.join(packageRoot, "package.json"),
        '{"name":"@hackerai/cli","version":"0.0.45","bin":{"hackerai":"./dist/bin.mjs"}}',
      );
      const resolve = resolveServerInstallation.pipe(
        Effect.provideService(HostProcess.Arguments, ["node", entry]),
        Effect.provideService(HostProcess.IsExecutable, false),
        Effect.provideService(HostProcess.Platform, "linux"),
      );
      expect(yield* resolve).toBeNull();
      yield* fs.symlink(entry, globalBin);
      expect(yield* resolve).toEqual({ kind: "npm-global", prefix });
      yield* fs.remove(globalBin);
      yield* fs.writeFileString(globalBin, "an unrelated hackerai command");
      expect(yield* resolve).toBeNull();
      expect(yield* resolve.pipe(Effect.provideService(HostProcess.Platform, "win32"))).toBeNull();
    }),
  );

  it.effect("proves the downloaded executable was started by a global npm launcher", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      // macOS reports /var and /private/var as different paths; the resolver compares real paths.
      const root = yield* fs.realPath(yield* fs.makeTempDirectoryScoped());
      const prefix = path.join(root, "bunx-tools");
      const packageRoot = path.join(prefix, "lib/node_modules/@hackerai/cli");
      const launcher = path.join(packageRoot, "bin/hackerai.mjs");
      const executable = path.join(root, ".hackerai/runtime/versions/1.0.0/hackerai");
      yield* fs.makeDirectory(path.dirname(launcher), { recursive: true });
      yield* fs.makeDirectory(path.dirname(executable), { recursive: true });
      yield* fs.makeDirectory(path.join(prefix, "bin"));
      yield* fs.writeFileString(launcher, "");
      yield* fs.writeFileString(executable, "");
      yield* fs.symlink(launcher, path.join(prefix, "bin/hackerai"));
      const resolve = resolveServerInstallation.pipe(
        Effect.provideService(HostProcess.ExecutablePath, executable),
        Effect.provideService(HostProcess.Arguments, [executable, executable]),
        Effect.provideService(HostProcess.IsExecutable, true),
        Effect.provideService(HostProcess.Platform, "linux"),
        Effect.provideService(HostProcess.Environment, { HACKERAI_NPM_LAUNCHER_PATH: launcher }),
      );
      for (const [version, expected] of [
        ["0.0.1", null],
        [packageJson.version, { kind: "npm-global", prefix }],
      ] as const) {
        yield* fs.writeFileString(
          path.join(packageRoot, "package.json"),
          `{"name":"@hackerai/cli","version":"${version}","bin":{"hackerai":"./bin/hackerai.mjs"}}`,
        );
        expect(yield* resolve).toEqual(expected);
      }
    }),
  );

  it.effect("names the launcher that started a downloaded runtime", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.realPath(yield* fs.makeTempDirectoryScoped());
      // The install script's launcher names ~/.hackerai, which here links to a home elsewhere.
      const executable = path.join(root, "data/hackerai/runtime/versions/1.0.0/hackerai");
      const launcher = path.join(root, "bin/hackerai");
      const copy = path.join(root, "bin/hackerai-copy");
      yield* fs.makeDirectory(path.dirname(executable), { recursive: true });
      yield* fs.makeDirectory(path.dirname(launcher), { recursive: true });
      yield* fs.writeFileString(executable, "", { mode: 0o755 });
      yield* fs.writeFileString(copy, "", { mode: 0o755 });
      yield* fs.symlink(path.join(root, "data/hackerai"), path.join(root, ".hackerai"));
      yield* fs.symlink(path.join(root, ".hackerai/runtime/versions/1.0.0/hackerai"), launcher);
      // Earlier PATH entries hold a directory and a non-executable file named hackerai.
      yield* fs.makeDirectory(path.join(root, "shadow-dir/hackerai"), { recursive: true });
      yield* fs.makeDirectory(path.join(root, "shadow-file"));
      yield* fs.writeFileString(path.join(root, "shadow-file/hackerai"), "");
      const resolve = (invokedAs: string, PATH = "shadow-dir:shadow-file:bin") =>
        resolveServerInstallation.pipe(
          Effect.provideService(HostProcess.ExecutablePath, executable),
          Effect.provideService(HostProcess.IsExecutable, true),
          Effect.provideService(HostProcess.InvokedAs, invokedAs),
          Effect.provideService(HostProcess.WorkingDirectory, root),
          Effect.provideService(HostProcess.Environment, { PATH }),
          Effect.provideService(HostProcess.HomeDirectory, root),
          Effect.provideService(HostProcess.Platform, "linux"),
        );
      const baseDir = path.join(root, ".hackerai");

      expect(yield* resolve("hackerai")).toEqual({ kind: "hackerai-launcher", launcher, baseDir });
      expect(yield* resolve(launcher)).toEqual({ kind: "hackerai-launcher", launcher, baseDir });
      expect(yield* resolve(executable)).toBeNull();
      expect(yield* resolve(copy)).toBeNull();

      // The script launcher execs the runtime by absolute path, so argv0 names the runtime.
      yield* fs.remove(launcher);
      yield* fs.writeFileString(
        launcher,
        posixLauncherScript(path.join(root, ".hackerai/runtime/versions/1.0.0/hackerai")),
        { mode: 0o755 },
      );
      expect(yield* resolve(executable, path.join(root, "bin"))).toEqual({
        kind: "hackerai-launcher",
        launcher,
        baseDir,
      });
    }),
  );

  it.effect("leaves local, standalone, missing and unreadable installs unknown", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped();
      for (const relative of [
        "project/node_modules/hackerai/dist/bin.mjs",
        "project/apps/server/dist/bin.mjs",
        ".hackerai/runtime/0.0.45/hackerai",
        "missing/dist/bin.mjs",
      ]) {
        const entry = path.join(root, relative);
        if (!relative.startsWith("missing")) {
          yield* fs.makeDirectory(path.dirname(entry), { recursive: true });
          yield* fs.writeFileString(entry, "");
        }
        expect(
          yield* resolveServerInstallation.pipe(
            Effect.provideService(HostProcess.Arguments, ["node", entry]),
            Effect.provideService(HostProcess.IsExecutable, false),
          ),
        ).toBeNull();
      }
    }),
  );
});
