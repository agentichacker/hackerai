// Codex speaks only the Responses wire API, while HackerAI's Responses endpoint returns a
// complete response object for non-streaming requests. This loopback bridge turns that object
// into the event stream Codex parses, so Codex can use the same API as the other tools.
// @effect-diagnostics nodeBuiltinImport:off globalFetch:off globalTimers:off - the bridge is a loopback Node HTTP server that forwards to the configured upstream.
import * as NodeHttp from "node:http";
import * as NodeCrypto from "node:crypto";

const BRIDGE_HOSTS = new Set(["api.hackerai.sh", "api.unlimitedai.sh"]);
const BRIDGE_PATH_PREFIX = "codex-responses";
const MAX_REQUEST_BYTES = 32 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 180_000;

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

export interface CodexResponsesBridgeUpstream {
  /** OpenAI-compatible root, such as `https://api.hackerai.sh/v1`. */
  readonly baseUrl: string;
  /** Sent as a bearer token when present; HackerAI accepts an empty key. */
  readonly apiKey: string;
}

/** The bridge is only for the HackerAI APIs; other base URLs are left to Codex itself. */
export function codexResponsesBridgeUpstream(
  environment: NodeJS.ProcessEnv,
): CodexResponsesBridgeUpstream | undefined {
  const raw = environment.OPENAI_BASE_URL?.trim();
  if (!raw) return undefined;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
  if (!BRIDGE_HOSTS.has(url.hostname)) return undefined;
  const path = url.pathname.replace(/\/+$/u, "");
  return {
    baseUrl: `${url.origin}${path.length > 0 ? path : "/v1"}`,
    apiKey: environment.OPENAI_API_KEY?.trim() ?? "",
  };
}

const quoteSetting = (setting: string) => JSON.stringify(setting);

/**
 * Points Codex at the loopback bridge through its custom-provider config. An explicit
 * `model_provider` in the user's launch arguments wins, so a deliberate route is not replaced.
 * `env_key` makes Codex send the HackerAI key; without it a custom provider sends no credential.
 */
export function withCodexResponsesBridgeLaunchArgs(
  launchArgs: string,
  baseUrl: string,
  apiKey = "",
): string {
  if (/(?:^|\s)(?:-c|--config)(?:=|\s+)\s*["']?model_provider\s*=/u.test(launchArgs)) {
    return launchArgs;
  }
  const settings = [
    `model_provider=${quoteSetting("hackerai")}`,
    `model_providers.hackerai.name=${quoteSetting("HackerAI")}`,
    `model_providers.hackerai.base_url=${quoteSetting(baseUrl)}`,
    `model_providers.hackerai.wire_api=${quoteSetting("responses")}`,
    "model_providers.hackerai.requires_openai_auth=false",
    "model_providers.hackerai.supports_websockets=false",
    ...(apiKey.trim().length === 0
      ? []
      : [`model_providers.hackerai.env_key=${quoteSetting("OPENAI_API_KEY")}`]),
  ];
  const bridgeArgs = settings.map((setting) => `-c ${quoteSetting(setting)}`).join(" ");
  return launchArgs.trim().length > 0 ? `${launchArgs} ${bridgeArgs}` : bridgeArgs;
}

interface SseEvent {
  readonly type: string;
  readonly sequence_number: number;
  readonly [key: string]: unknown;
}

const sseEvent = (event: SseEvent): string =>
  `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;

const withoutProviderSecrets = (response: JsonRecord): JsonRecord => {
  // HackerAI includes the upstream provider and its key in the response; neither belongs in
  // the agent transcript or its logs.
  const { modelKey: _modelKey, provider: _provider, ...rest } = response;
  return rest;
};

const itemId = (item: JsonRecord, index: number): string =>
  readString(item.id) ?? `item_${index}`;

const outputTextPart = (
  item: JsonRecord,
  part: JsonRecord,
  outputIndex: number,
  contentIndex: number,
  itemIdValue: string,
  send: (type: string, payload: Record<string, unknown>) => void,
) => {
  const text = readString(part.text) ?? "";
  send("response.content_part.added", {
    item_id: itemIdValue,
    output_index: outputIndex,
    content_index: contentIndex,
    part: { ...part, text: "" },
  });
  send("response.output_text.delta", {
    item_id: itemIdValue,
    output_index: outputIndex,
    content_index: contentIndex,
    delta: text,
  });
  send("response.output_text.done", {
    item_id: itemIdValue,
    output_index: outputIndex,
    content_index: contentIndex,
    text,
  });
  send("response.content_part.done", {
    item_id: itemIdValue,
    output_index: outputIndex,
    content_index: contentIndex,
    part,
  });
};

const refusalPart = (
  item: JsonRecord,
  part: JsonRecord,
  outputIndex: number,
  contentIndex: number,
  itemIdValue: string,
  send: (type: string, payload: Record<string, unknown>) => void,
) => {
  const refusal = readString(part.refusal) ?? "";
  send("response.refusal.delta", {
    item_id: itemIdValue,
    output_index: outputIndex,
    content_index: contentIndex,
    delta: refusal,
  });
  send("response.refusal.done", {
    item_id: itemIdValue,
    output_index: outputIndex,
    content_index: contentIndex,
    refusal,
  });
};

/**
 * Builds the SSE body Codex expects from a complete Responses object. One text delta carries
 * the whole answer because the upstream call is non-streaming; Codex still receives every
 * lifecycle event it uses to build the turn.
 */
export function codexResponsesSse(rawResponse: JsonRecord): string {
  const response = withoutProviderSecrets(rawResponse);
  const events: Array<string> = [];
  let sequence = 0;
  const send = (type: string, payload: Record<string, unknown>) => {
    events.push(sseEvent({ type, sequence_number: sequence++, ...payload }));
  };

  const created = { ...response, status: "in_progress", output: [] };
  send("response.created", { response: created });

  const output = Array.isArray(response.output) ? response.output : [];
  output.forEach((rawItem, outputIndex) => {
    if (!isRecord(rawItem)) return;
    const id = itemId(rawItem, outputIndex);
    const itemType = readString(rawItem.type);
    const started = {
      ...rawItem,
      status: rawItem.status === "completed" ? "in_progress" : (rawItem.status ?? "in_progress"),
    };
    send("response.output_item.added", { output_index: outputIndex, item: started });

    if (itemType === "message") {
      const content = Array.isArray(rawItem.content) ? rawItem.content : [];
      content.forEach((rawPart, contentIndex) => {
        if (!isRecord(rawPart)) return;
        const partType = readString(rawPart.type);
        if (partType === "output_text") {
          outputTextPart(rawItem, rawPart, outputIndex, contentIndex, id, send);
        } else if (partType === "refusal") {
          refusalPart(rawItem, rawPart, outputIndex, contentIndex, id, send);
        }
      });
    } else if (itemType === "function_call") {
      const args = readString(rawItem.arguments) ?? "";
      send("response.function_call_arguments.delta", {
        item_id: id,
        output_index: outputIndex,
        delta: args,
      });
      send("response.function_call_arguments.done", {
        item_id: id,
        output_index: outputIndex,
        arguments: args,
      });
    }

    send("response.output_item.done", { output_index: outputIndex, item: rawItem });
  });

  const terminalType =
    response.status === "failed"
      ? "response.failed"
      : response.status === "incomplete"
        ? "response.incomplete"
        : "response.completed";
  send(terminalType, { response });
  return events.join("");
}

const readRequestBody = async (request: NodeHttp.IncomingMessage): Promise<string | undefined> => {
  const chunks: Array<Buffer> = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_REQUEST_BYTES) return undefined;
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
};

const writeJson = (
  response: NodeHttp.ServerResponse,
  status: number,
  body: unknown,
): void => {
  const text = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(text),
  });
  response.end(text);
};

const upstreamHeaders = (apiKey: string): Record<string, string> => ({
  "content-type": "application/json",
  ...(apiKey.length > 0 ? { authorization: `Bearer ${apiKey}` } : {}),
});

const proxyModels = async (
  response: NodeHttp.ServerResponse,
  upstream: CodexResponsesBridgeUpstream,
): Promise<void> => {
  const result = await fetch(`${upstream.baseUrl}/models`, {
    headers: upstreamHeaders(upstream.apiKey),
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  const text = await result.text();
  response.writeHead(result.status, {
    "content-type": result.headers.get("content-type") ?? "application/json",
    "content-length": Buffer.byteLength(text),
  });
  response.end(text);
};

const proxyResponses = async (
  request: NodeHttp.IncomingMessage,
  response: NodeHttp.ServerResponse,
  upstream: CodexResponsesBridgeUpstream,
): Promise<void> => {
  const body = await readRequestBody(request);
  if (body === undefined) {
    writeJson(response, 413, { error: { message: "Request body is too large." } });
    return;
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(body);
  } catch {
    writeJson(response, 400, { error: { message: "Request body is not valid JSON." } });
    return;
  }
  if (!isRecord(decoded)) {
    writeJson(response, 400, { error: { message: "Request body must be a JSON object." } });
    return;
  }

  const controller = new AbortController();
  const abort = () => controller.abort();
  response.on("close", abort);
  const timeout = setTimeout(abort, UPSTREAM_TIMEOUT_MS);
  try {
    const result = await fetch(`${upstream.baseUrl}/responses`, {
      method: "POST",
      headers: upstreamHeaders(upstream.apiKey),
      body: JSON.stringify({ ...decoded, stream: false }),
      signal: controller.signal,
    });
    const text = await result.text();
    if (!result.ok) {
      response.writeHead(result.status, {
        "content-type": result.headers.get("content-type") ?? "application/json",
        "content-length": Buffer.byteLength(text),
      });
      response.end(text);
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      writeJson(response, 502, { error: { message: "HackerAI returned an unreadable response." } });
      return;
    }
    if (!isRecord(parsed) || parsed.object !== "response") {
      writeJson(response, 502, {
        error: { message: "HackerAI did not return a Responses API object." },
      });
      return;
    }
    const sse = codexResponsesSse(withoutProviderSecrets(parsed));
    response.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });
    response.end(sse);
  } catch {
    if (response.headersSent) {
      response.destroy();
      return;
    }
    const timedOut = controller.signal.aborted;
    writeJson(response, timedOut ? 504 : 502, {
      error: { message: timedOut ? "HackerAI took too long to answer." : "Could not reach HackerAI." },
    });
  } finally {
    clearTimeout(timeout);
    response.off("close", abort);
  }
};

const handleRequest = async (
  request: NodeHttp.IncomingMessage,
  response: NodeHttp.ServerResponse,
  token: string,
  upstream: CodexResponsesBridgeUpstream,
): Promise<void> => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  const prefix = `/${BRIDGE_PATH_PREFIX}/${token}/v1`;
  if (url.pathname !== prefix && !url.pathname.startsWith(`${prefix}/`)) {
    writeJson(response, 404, { error: { message: "Not found." } });
    return;
  }
  const suffix = url.pathname.slice(prefix.length).replace(/\/+$/u, "");
  if (suffix === "/models" && request.method === "GET") {
    await proxyModels(response, upstream);
    return;
  }
  if (suffix === "/responses" && request.method === "POST") {
    await proxyResponses(request, response, upstream);
    return;
  }
  writeJson(response, 404, { error: { message: "Not found." } });
};

export interface CodexResponsesBridge {
  /** Pass this to Codex as `model_providers.hackerai.base_url`. */
  readonly baseUrl: string;
}

const bridges = new Map<string, Promise<CodexResponsesBridge>>();

const startBridge = async (
  upstream: CodexResponsesBridgeUpstream,
): Promise<CodexResponsesBridge> => {
  const token = NodeCrypto.randomBytes(24).toString("hex");
  const server = NodeHttp.createServer((request, response) => {
    void handleRequest(request, response, token, upstream).catch(() => {
      if (!response.headersSent) writeJson(response, 500, { error: { message: "Bridge failed." } });
      else response.destroy();
    });
  });
  // The app server owns the process lifetime; an idle bridge must not hold it open.
  server.unref();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    server.close();
    throw new Error("Could not read the Codex bridge address.");
  }
  return { baseUrl: `http://127.0.0.1:${address.port}/${BRIDGE_PATH_PREFIX}/${token}/v1` };
};

/**
 * Reuses one loopback listener per upstream and key. A settings change starts a new one;
 * the previous listener stays bound until the process exits, which keeps provider reloads
 * from racing a Codex process that is still using it.
 */
export function getCodexResponsesBridge(
  upstream: CodexResponsesBridgeUpstream,
): Promise<CodexResponsesBridge> {
  const cacheKey = `${upstream.baseUrl}\u0000${upstream.apiKey}`;
  const existing = bridges.get(cacheKey);
  if (existing !== undefined) return existing;
  const created = startBridge(upstream).catch((error: unknown) => {
    bridges.delete(cacheKey);
    throw error;
  });
  bridges.set(cacheKey, created);
  return created;
}
