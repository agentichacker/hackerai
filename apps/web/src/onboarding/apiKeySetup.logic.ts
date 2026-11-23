import {
  isProviderAvailable,
  PROVIDER_DISPLAY_NAMES,
  ProviderDriverKind,
  ProviderInstanceId,
  type ProviderInstanceConfig,
  type ProviderInstanceEnvironmentVariable,
  type ServerProvider,
} from "@hackerai/contracts";

import { turnedOnInstance } from "./welcomePage.logic";

export const API_KEY_PROVIDER_IDS = ["hackerai", "unlimitedai"] as const;
export type ApiKeyProviderId = (typeof API_KEY_PROVIDER_IDS)[number];

export interface ApiKeyProviderOption {
  readonly id: ApiKeyProviderId;
  readonly label: string;
  /** The host the app talks to, shown while checking and after setup. */
  readonly host: string;
  /** OpenAI-compatible root: models and chat completions live under it. */
  readonly openaiBaseUrl: string;
  /**
   * Anthropic-compatible root. Claude Code appends `/v1/messages` itself, so this is the
   * origin, not the `.../v1` prefix.
   */
  readonly anthropicBaseUrl: string;
  readonly keyUrl: string;
  /** HackerAI answers without a key, so a check there proves the endpoint but not the key. */
  readonly requiresKey: boolean;
}

export const API_KEY_PROVIDERS: Readonly<Record<ApiKeyProviderId, ApiKeyProviderOption>> = {
  hackerai: {
    id: "hackerai",
    label: "HackerAI",
    host: "api.hackerai.sh",
    openaiBaseUrl: "https://api.hackerai.sh/v1",
    anthropicBaseUrl: "https://api.hackerai.sh",
    keyUrl: "https://hackerai.sh/pricing",
    requiresKey: false,
  },
  unlimitedai: {
    id: "unlimitedai",
    label: "UnlimitedAI",
    host: "api.unlimitedai.sh",
    openaiBaseUrl: "https://api.unlimitedai.sh/v1",
    anthropicBaseUrl: "https://api.unlimitedai.sh",
    keyUrl: "https://unlimitedai.sh",
    requiresKey: true,
  },
};

export const isApiKeyProviderId = (value: string): value is ApiKeyProviderId =>
  (API_KEY_PROVIDER_IDS as ReadonlyArray<string>).includes(value);

/** The text generator a checked key is saved as. It shares ids with provider instances. */
export function apiKeyTextGeneratorId(provider: ApiKeyProviderId): ProviderInstanceId {
  return ProviderInstanceId.make(`${provider}-api`);
}

export const CODEX_DRIVER = ProviderDriverKind.make("codex");
export const CLAUDE_DRIVER = ProviderDriverKind.make("claudeAgent");

/** The agents whose CLI reads a base URL and key from its environment. */
export const API_KEY_TOOL_DRIVERS: ReadonlyArray<{
  readonly driver: ProviderDriverKind;
  readonly label: string;
}> = [
  { driver: CODEX_DRIVER, label: PROVIDER_DISPLAY_NAMES[CODEX_DRIVER] ?? "Codex" },
  { driver: CLAUDE_DRIVER, label: PROVIDER_DISPLAY_NAMES[CLAUDE_DRIVER] ?? "Claude" },
];

const toolDriverIndex = (driver: ProviderDriverKind): number =>
  API_KEY_TOOL_DRIVERS.findIndex((tool) => tool.driver === driver);

/** One agent this API can drive, as the setup picker lists it. */
export interface ApiKeyToolChoice {
  readonly instanceId: ProviderInstanceId;
  readonly driver: ProviderDriverKind;
  readonly displayName: string;
  readonly installed: boolean;
}

/**
 * The agents to offer for this API, one row per configured instance plus a row for a tool with no
 * instance yet: its environment is ready before the CLI is installed, so the first run after an
 * install already goes through the key. Installed agents come first, then the usual tool order.
 * An agent this computer cannot run, or its administrator does not allow, is not offered at all.
 */
export function apiKeyToolChoices(
  providers: ReadonlyArray<ServerProvider> | null | undefined,
  isAllowed: (driver: ProviderDriverKind) => boolean = () => true,
): ReadonlyArray<ApiKeyToolChoice> {
  const choices: Array<ApiKeyToolChoice> = [];
  const seen = new Set<string>();
  for (const provider of providers ?? []) {
    const tool = API_KEY_TOOL_DRIVERS.find((candidate) => candidate.driver === provider.driver);
    if (tool === undefined || seen.has(provider.instanceId)) continue;
    if (!isProviderAvailable(provider) || !isAllowed(provider.driver)) continue;
    seen.add(provider.instanceId);
    choices.push({
      instanceId: provider.instanceId,
      driver: provider.driver,
      displayName: provider.displayName ?? tool.label,
      installed: provider.installed,
    });
  }
  for (const tool of API_KEY_TOOL_DRIVERS) {
    if (choices.some((choice) => choice.driver === tool.driver)) continue;
    if (!isAllowed(tool.driver)) continue;
    choices.push({
      instanceId: ProviderInstanceId.make(tool.driver),
      driver: tool.driver,
      displayName: tool.label,
      installed: false,
    });
  }
  return choices.toSorted(
    (left, right) =>
      Number(right.installed) - Number(left.installed) ||
      toolDriverIndex(left.driver) - toolDriverIndex(right.driver) ||
      left.displayName.localeCompare(right.displayName),
  );
}

/** An agent in the same list that a base URL cannot redirect: it keeps its own login. */
export interface ApiKeyUnsupportedTool {
  readonly driver: ProviderDriverKind;
  readonly label: string;
}

export function apiKeyUnsupportedTools(
  providers: ReadonlyArray<ServerProvider> | null | undefined,
  isAllowed: (driver: ProviderDriverKind) => boolean = () => true,
): ReadonlyArray<ApiKeyUnsupportedTool> {
  const tools: Array<ApiKeyUnsupportedTool> = [];
  const seen = new Set<string>();
  for (const provider of providers ?? []) {
    if (toolDriverIndex(provider.driver) !== -1 || seen.has(provider.driver)) continue;
    if (!isAllowed(provider.driver)) continue;
    seen.add(provider.driver);
    tools.push({
      driver: provider.driver,
      label: provider.displayName ?? PROVIDER_DISPLAY_NAMES[provider.driver] ?? provider.instanceId,
    });
  }
  return tools.toSorted((left, right) => left.label.localeCompare(right.label));
}

/** The variables a driver reads to route through a compatible API instead of its own login. */
export function apiKeyEnvironment(
  driver: ProviderDriverKind,
  provider: ApiKeyProviderId,
  apiKey: string,
): ReadonlyArray<ProviderInstanceEnvironmentVariable> {
  const option = API_KEY_PROVIDERS[provider];
  const key = apiKey.trim();
  // Both CLIs refuse to start with an empty credential even when the endpoint needs no key.
  const credential = key.length > 0 ? key : provider === "hackerai" ? "hackerai-keyless" : key;
  if (driver === CODEX_DRIVER) {
    return [
      { name: "OPENAI_BASE_URL", value: option.openaiBaseUrl, sensitive: false },
      { name: "OPENAI_API_KEY", value: credential, sensitive: true },
    ];
  }
  if (driver === CLAUDE_DRIVER) {
    return [
      { name: "ANTHROPIC_BASE_URL", value: option.anthropicBaseUrl, sensitive: false },
      { name: "ANTHROPIC_AUTH_TOKEN", value: credential, sensitive: true },
      // An empty key keeps Claude Code on the token above instead of a stored Anthropic login.
      { name: "ANTHROPIC_API_KEY", value: "", sensitive: false },
    ];
  }
  return [];
}

const environmentName = (variable: ProviderInstanceEnvironmentVariable): string =>
  variable.name.toUpperCase();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The instance to save for a target: its own settings, with the routing variables replacing any
 * earlier copies. Codex also has to leave its managed runtime, which drops these variables.
 * The agent is turned on both ways a saved instance can be off, or the key would never be read.
 */
export function withApiKeyEnvironment(
  instance: ProviderInstanceConfig,
  driver: ProviderDriverKind,
  provider: ApiKeyProviderId,
  apiKey: string,
): ProviderInstanceConfig {
  const added = apiKeyEnvironment(driver, provider, apiKey);
  if (added.length === 0) return instance;
  const replaced = new Set(added.map(environmentName));
  const environment = [
    ...(instance.environment ?? []).filter((variable) => !replaced.has(environmentName(variable))),
    ...added,
  ];
  const config =
    driver === CODEX_DRIVER
      ? { ...(isRecord(instance.config) ? instance.config : {}), setupMode: "existing" as const }
      : instance.config;
  return turnedOnInstance({
    ...instance,
    environment,
    ...(config === undefined ? {} : { config }),
  });
}

/** The instance fields an administrator pins, as far as a key setup is concerned. */
export interface ApiKeyEnvironmentLock {
  readonly wholeEnvironment: boolean;
  readonly environmentNames: ReadonlySet<string>;
}

/**
 * Whether this computer's policy keeps the key from reaching the agent's environment. Saving such
 * an instance would be rejected or silently drop the key, so the agent is not offered.
 */
export function apiKeyEnvironmentLocked(
  lock: ApiKeyEnvironmentLock | undefined,
  driver: ProviderDriverKind,
  provider: ApiKeyProviderId,
): boolean {
  if (lock === undefined) return false;
  if (lock.wholeEnvironment) return true;
  return apiKeyEnvironment(driver, provider, "").some((variable) =>
    lock.environmentNames.has(variable.name),
  );
}
