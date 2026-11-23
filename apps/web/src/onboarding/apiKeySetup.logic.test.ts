import {
  ProviderDriverKind,
  ProviderInstanceId,
  type ProviderInstanceConfig,
  type ServerProvider,
} from "@hackerai/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  apiKeyEnvironment,
  apiKeyEnvironmentLocked,
  apiKeyTextGeneratorId,
  apiKeyToolChoices,
  apiKeyUnsupportedTools,
  CLAUDE_DRIVER,
  CODEX_DRIVER,
  withApiKeyEnvironment,
  type ApiKeyEnvironmentLock,
} from "./apiKeySetup.logic";

const CURSOR_DRIVER = ProviderDriverKind.make("cursor");
const GROK_DRIVER = ProviderDriverKind.make("grok");

const provider = (overrides: Partial<ServerProvider> & Pick<ServerProvider, "instanceId">) =>
  ({
    driver: ProviderDriverKind.make(overrides.instanceId),
    enabled: true,
    installed: true,
    version: "1.0.0",
    status: "ready",
    auth: { status: "unknown" },
    checkedAt: "2026-11-21T00:00:00.000Z",
    models: [],
    slashCommands: [],
    skills: [],
    ...overrides,
  }) satisfies ServerProvider;

const claudeInstance: ProviderInstanceConfig = {
  driver: CLAUDE_DRIVER,
  environment: [{ name: "EXISTING", value: "kept", sensitive: false }],
  enabled: false,
};

describe("apiKeyToolChoices", () => {
  it("offers installed agents first, then tools with no instance yet", () => {
    const choices = apiKeyToolChoices([
      provider({ instanceId: ProviderInstanceId.make("codex"), driver: CODEX_DRIVER }),
      provider({
        instanceId: ProviderInstanceId.make("claudeAgent"),
        driver: CLAUDE_DRIVER,
        installed: false,
      }),
    ]);

    expect(choices.map((choice) => [choice.instanceId, choice.driver, choice.installed])).toEqual([
      ["codex", CODEX_DRIVER, true],
      ["claudeAgent", CLAUDE_DRIVER, false],
    ]);
  });

  it("lists every configured instance of a tool the API can drive", () => {
    const choices = apiKeyToolChoices([
      provider({
        instanceId: ProviderInstanceId.make("codex-work"),
        driver: CODEX_DRIVER,
        displayName: "Codex work",
      }),
    ]);

    expect(choices.map((choice) => [choice.instanceId, choice.displayName])).toEqual([
      ["codex-work", "Codex work"],
      ["claudeAgent", "Claude"],
    ]);
  });

  it("offers both tools before any provider has loaded", () => {
    expect(apiKeyToolChoices(null).map((choice) => choice.instanceId)).toEqual([
      "codex",
      "claudeAgent",
    ]);
    expect(apiKeyToolChoices(undefined)).toEqual(apiKeyToolChoices([]));
  });

  it("leaves out agents that a base URL cannot redirect", () => {
    const choices = apiKeyToolChoices([
      provider({ instanceId: ProviderInstanceId.make("grok") }),
      provider({ instanceId: ProviderInstanceId.make("cursor") }),
    ]);

    expect(choices.map((choice) => choice.driver)).toEqual([CODEX_DRIVER, CLAUDE_DRIVER]);
  });

  it("falls back to the tool name when the provider has no display name", () => {
    const [choice] = apiKeyToolChoices([
      provider({ instanceId: ProviderInstanceId.make("codex"), driver: CODEX_DRIVER }),
    ]);
    expect(choice?.displayName).toBe("Codex");
  });

  it("leaves out a driver this computer does not allow, including its not-yet-installed row", () => {
    const choices = apiKeyToolChoices(
      [provider({ instanceId: ProviderInstanceId.make("codex"), driver: CODEX_DRIVER })],
      (driver) => driver === CLAUDE_DRIVER,
    );

    expect(choices.map((choice) => choice.driver)).toEqual([CLAUDE_DRIVER]);
    expect(apiKeyToolChoices(null, (driver) => driver === CLAUDE_DRIVER)).toEqual([
      {
        instanceId: ProviderInstanceId.make("claudeAgent"),
        driver: CLAUDE_DRIVER,
        displayName: "Claude",
        installed: false,
      },
    ]);
  });
});

describe("apiKeyUnsupportedTools", () => {
  it("names each other agent once, alphabetically", () => {
    const tools = apiKeyUnsupportedTools([
      provider({ instanceId: ProviderInstanceId.make("grok"), driver: GROK_DRIVER }),
      provider({ instanceId: ProviderInstanceId.make("grok-work"), driver: GROK_DRIVER }),
      provider({ instanceId: ProviderInstanceId.make("cursor"), driver: CURSOR_DRIVER }),
      provider({ instanceId: ProviderInstanceId.make("codex"), driver: CODEX_DRIVER }),
    ]);

    expect(tools).toEqual([
      { driver: CURSOR_DRIVER, label: "Cursor" },
      { driver: GROK_DRIVER, label: "Grok" },
    ]);
  });

  it("falls back to the instance id for a driver with no display name", () => {
    const [tool] = apiKeyUnsupportedTools([
      provider({ instanceId: ProviderInstanceId.make("my-cli") }),
    ]);
    expect(tool?.label).toBe("my-cli");
  });

  it("has nothing to report before providers load", () => {
    expect(apiKeyUnsupportedTools(null)).toEqual([]);
    expect(apiKeyUnsupportedTools(undefined)).toEqual([]);
  });

  it("does not report an agent this computer does not allow", () => {
    expect(
      apiKeyUnsupportedTools(
        [
          provider({ instanceId: ProviderInstanceId.make("grok"), driver: GROK_DRIVER }),
          provider({ instanceId: ProviderInstanceId.make("cursor"), driver: CURSOR_DRIVER }),
        ],
        (driver) => driver === GROK_DRIVER,
      ),
    ).toEqual([{ driver: GROK_DRIVER, label: "Grok" }]);
  });
});

describe("apiKeyEnvironment", () => {
  it("points Codex at the OpenAI-compatible root with a sensitive key", () => {
    expect(apiKeyEnvironment(CODEX_DRIVER, "hackerai", "  sk-test  ")).toEqual([
      { name: "OPENAI_BASE_URL", value: "https://api.hackerai.sh/v1", sensitive: false },
      { name: "OPENAI_API_KEY", value: "sk-test", sensitive: true },
    ]);
  });

  it("points Claude at the origin, because Claude Code appends /v1/messages itself", () => {
    expect(apiKeyEnvironment(CLAUDE_DRIVER, "unlimitedai", "sk-test")).toEqual([
      { name: "ANTHROPIC_BASE_URL", value: "https://api.unlimitedai.sh", sensitive: false },
      { name: "ANTHROPIC_AUTH_TOKEN", value: "sk-test", sensitive: true },
      { name: "ANTHROPIC_API_KEY", value: "", sensitive: false },
    ]);
  });

  it("leaves a driver it cannot route untouched", () => {
    expect(apiKeyEnvironment(ProviderDriverKind.make("grok"), "hackerai", "sk-test")).toEqual([]);
  });

  it("gives a keyless HackerAI setup a non-empty credential for both CLIs", () => {
    expect(apiKeyEnvironment(CLAUDE_DRIVER, "hackerai", "   ")).toEqual([
      { name: "ANTHROPIC_BASE_URL", value: "https://api.hackerai.sh", sensitive: false },
      { name: "ANTHROPIC_AUTH_TOKEN", value: "hackerai-keyless", sensitive: true },
      { name: "ANTHROPIC_API_KEY", value: "", sensitive: false },
    ]);
    expect(apiKeyEnvironment(CODEX_DRIVER, "hackerai", "")).toEqual([
      { name: "OPENAI_BASE_URL", value: "https://api.hackerai.sh/v1", sensitive: false },
      { name: "OPENAI_API_KEY", value: "hackerai-keyless", sensitive: true },
    ]);
  });
});

describe("withApiKeyEnvironment", () => {
  it("keeps unrelated settings and replaces earlier copies of the routing variables", () => {
    const next = withApiKeyEnvironment(
      {
        ...claudeInstance,
        environment: [
          { name: "EXISTING", value: "kept", sensitive: false },
          { name: "ANTHROPIC_BASE_URL", value: "https://old.example", sensitive: false },
        ],
        config: { model: "opus" },
      },
      CLAUDE_DRIVER,
      "hackerai",
      "sk-test",
    );

    expect(next.enabled).toBe(true);
    expect(next.config).toEqual({ model: "opus" });
    expect(next.environment).toEqual([
      { name: "EXISTING", value: "kept", sensitive: false },
      { name: "ANTHROPIC_BASE_URL", value: "https://api.hackerai.sh", sensitive: false },
      { name: "ANTHROPIC_AUTH_TOKEN", value: "sk-test", sensitive: true },
      { name: "ANTHROPIC_API_KEY", value: "", sensitive: false },
    ]);
  });

  it("moves Codex off its managed runtime, which drops the variables again", () => {
    const next = withApiKeyEnvironment(
      { driver: CODEX_DRIVER, config: { model: "gpt-6.2-codex" } },
      CODEX_DRIVER,
      "unlimitedai",
      "sk-test",
    );

    expect(next.config).toEqual({ model: "gpt-6.2-codex", setupMode: "existing" });
    expect(next.environment).toEqual([
      { name: "OPENAI_BASE_URL", value: "https://api.unlimitedai.sh/v1", sensitive: false },
      { name: "OPENAI_API_KEY", value: "sk-test", sensitive: true },
    ]);
  });

  it("treats a driver with no routing variables as a no-op", () => {
    const instance: ProviderInstanceConfig = { driver: ProviderDriverKind.make("grok") };
    expect(withApiKeyEnvironment(instance, instance.driver, "hackerai", "sk-test")).toBe(instance);
  });

  it("turns on an instance whose own config was off", () => {
    const next = withApiKeyEnvironment(
      { driver: CLAUDE_DRIVER, config: { enabled: false } },
      CLAUDE_DRIVER,
      "hackerai",
      "sk-test",
    );

    expect(next.enabled).toBe(true);
    expect(next.config).toEqual({ enabled: true });
  });
});

describe("apiKeyEnvironmentLocked", () => {
  const lock = (overrides: Partial<ApiKeyEnvironmentLock>): ApiKeyEnvironmentLock => ({
    wholeEnvironment: false,
    environmentNames: new Set<string>(),
    ...overrides,
  });

  it("is open without a policy", () => {
    expect(apiKeyEnvironmentLocked(undefined, CLAUDE_DRIVER, "hackerai")).toBe(false);
  });

  it("is closed when the administrator pins one of the routing variables", () => {
    expect(
      apiKeyEnvironmentLocked(
        lock({ environmentNames: new Set(["ANTHROPIC_AUTH_TOKEN"]) }),
        CLAUDE_DRIVER,
        "hackerai",
      ),
    ).toBe(true);
    // A variable this API would not write keeps the agent available.
    expect(
      apiKeyEnvironmentLocked(
        lock({ environmentNames: new Set(["HTTPS_PROXY"]) }),
        CLAUDE_DRIVER,
        "hackerai",
      ),
    ).toBe(false);
    expect(apiKeyEnvironmentLocked(lock({}), CODEX_DRIVER, "unlimitedai")).toBe(false);
  });

  it("is closed for every driver when the administrator pins the whole environment", () => {
    expect(
      apiKeyEnvironmentLocked(lock({ wholeEnvironment: true }), CODEX_DRIVER, "hackerai"),
    ).toBe(true);
  });
});

describe("apiKeyTextGeneratorId", () => {
  it("saves each key under a stable generator id", () => {
    expect(apiKeyTextGeneratorId("hackerai")).toBe("hackerai-api");
    expect(apiKeyTextGeneratorId("unlimitedai")).toBe("unlimitedai-api");
  });
});
