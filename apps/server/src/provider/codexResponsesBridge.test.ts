// @effect-diagnostics nodeBuiltinImport:off globalFetch:off - the test drives the loopback bridge over real HTTP.
import * as NodeAssert from "node:assert/strict";
import * as NodeHttp from "node:http";

import { describe, it } from "vite-plus/test";

import {
  codexResponsesBridgeUpstream,
  codexResponsesSse,
  getCodexResponsesBridge,
  withCodexResponsesBridgeLaunchArgs,
} from "./codexResponsesBridge.ts";

const responseObject = {
  id: "resp_1",
  object: "response",
  created_at: 1,
  status: "completed",
  model: "auto",
  output: [
    {
      id: "msg_1",
      type: "message",
      role: "assistant",
      status: "completed",
      content: [{ type: "output_text", text: "hello", annotations: [], logprobs: [] }],
    },
  ],
  usage: { input_tokens: 3, output_tokens: 2, total_tokens: 5 },
  provider: "secret-provider",
  modelKey: "sk-or-v1-secret",
};

const eventTypes = (sse: string) =>
  sse
    .split("\n")
    .filter((line) => line.startsWith("event: "))
    .map((line) => line.slice("event: ".length));

describe("codexResponsesBridgeUpstream", () => {
  it("recognizes both HackerAI API hosts and keeps their version prefix", () => {
    NodeAssert.deepStrictEqual(
      codexResponsesBridgeUpstream({ OPENAI_BASE_URL: "https://api.hackerai.sh/v1" }),
      { baseUrl: "https://api.hackerai.sh/v1", apiKey: "" },
    );
    NodeAssert.deepStrictEqual(
      codexResponsesBridgeUpstream({
        OPENAI_BASE_URL: "https://api.unlimitedai.sh/v1/",
        OPENAI_API_KEY: "sk-test",
      }),
      { baseUrl: "https://api.unlimitedai.sh/v1", apiKey: "sk-test" },
    );
  });

  it("leaves every other endpoint to Codex", () => {
    NodeAssert.equal(codexResponsesBridgeUpstream({}), undefined);
    NodeAssert.equal(
      codexResponsesBridgeUpstream({ OPENAI_BASE_URL: "https://api.openai.com/v1" }),
      undefined,
    );
    NodeAssert.equal(
      codexResponsesBridgeUpstream({ OPENAI_BASE_URL: "not a url" }),
      undefined,
    );
  });
});

describe("withCodexResponsesBridgeLaunchArgs", () => {
  it("adds a custom provider that points Codex at the loopback bridge", () => {
    const args = withCodexResponsesBridgeLaunchArgs(
      "--strict-config",
      "http://127.0.0.1:1234/x/v1",
      "sk-test",
    );
    NodeAssert.match(args, /^--strict-config -c /u);
    // Each `-c` value is one shell word, so its inner quotes arrive escaped.
    const settings = args.replaceAll('\\"', '"');
    NodeAssert.match(settings, /model_provider="hackerai"/u);
    NodeAssert.match(
      settings,
      /model_providers\.hackerai\.base_url="http:\/\/127\.0\.0\.1:1234\/x\/v1"/u,
    );
    NodeAssert.match(settings, /model_providers\.hackerai\.wire_api="responses"/u);
    NodeAssert.match(settings, /model_providers\.hackerai\.requires_openai_auth=false/u);
    NodeAssert.match(settings, /model_providers\.hackerai\.supports_websockets=false/u);
    NodeAssert.match(settings, /model_providers\.hackerai\.env_key="OPENAI_API_KEY"/u);
  });

  it("omits the key variable when no credential was configured", () => {
    const args = withCodexResponsesBridgeLaunchArgs("", "http://127.0.0.1:1234/x/v1");
    NodeAssert.doesNotMatch(args, /env_key/u);
  });

  it("keeps an explicit model provider from the user's launch arguments", () => {
    NodeAssert.equal(
      withCodexResponsesBridgeLaunchArgs(
        '-c model_provider="openai"',
        "http://127.0.0.1:1234/x/v1",
      ),
      '-c model_provider="openai"',
    );
  });
});

describe("codexResponsesSse", () => {
  it("replays the response lifecycle Codex needs, without upstream provider secrets", () => {
    const sse = codexResponsesSse(responseObject);
    NodeAssert.deepStrictEqual(eventTypes(sse), [
      "response.created",
      "response.output_item.added",
      "response.content_part.added",
      "response.output_text.delta",
      "response.output_text.done",
      "response.content_part.done",
      "response.output_item.done",
      "response.completed",
    ]);
    NodeAssert.match(sse, /"delta":"hello"/u);
    NodeAssert.doesNotMatch(sse, /modelKey|sk-or-v1-secret|secret-provider/u);
  });

  it("emits function-call arguments for a tool call", () => {
    const sse = codexResponsesSse({
      ...responseObject,
      output: [
        {
          id: "fc_1",
          type: "function_call",
          call_id: "call_1",
          name: "add",
          arguments: '{"a":2,"b":2}',
          status: "completed",
        },
      ],
    });
    NodeAssert.deepStrictEqual(eventTypes(sse), [
      "response.created",
      "response.output_item.added",
      "response.function_call_arguments.delta",
      "response.function_call_arguments.done",
      "response.output_item.done",
      "response.completed",
    ]);
    NodeAssert.ok(sse.includes('"delta":"{\\"a\\":2,\\"b\\":2}"'));
  });
});

describe("getCodexResponsesBridge", () => {
  it("forwards a non-streaming Responses request and returns an SSE response", async () => {
    let received: {
      body?: Record<string, unknown>;
      authorization?: string | undefined;
    } = {};
    const upstream = NodeHttp.createServer((request, response) => {
      let body = "";
      request.setEncoding("utf8");
      request.on("data", (chunk: string) => {
        body += chunk;
      });
      request.on("end", () => {
        received = {
          body: JSON.parse(body) as Record<string, unknown>,
          authorization: request.headers.authorization,
        };
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify(responseObject));
      });
    });
    await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
    const address = upstream.address();
    NodeAssert.ok(address !== null && typeof address !== "string");
    try {
      const bridge = await getCodexResponsesBridge({
        baseUrl: `http://127.0.0.1:${address.port}/v1`,
        apiKey: "sk-test",
      });
      const result = await fetch(`${bridge.baseUrl}/responses`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: "auto", input: "hi", stream: true }),
      });
      NodeAssert.equal(result.status, 200);
      NodeAssert.match(result.headers.get("content-type") ?? "", /text\/event-stream/u);
      const text = await result.text();
      NodeAssert.deepStrictEqual(eventTypes(text), [
        "response.created",
        "response.output_item.added",
        "response.content_part.added",
        "response.output_text.delta",
        "response.output_text.done",
        "response.content_part.done",
        "response.output_item.done",
        "response.completed",
      ]);
      NodeAssert.equal(received.body?.stream, false);
      NodeAssert.equal(received.authorization, "Bearer sk-test");
      NodeAssert.doesNotMatch(text, /modelKey|sk-or-v1-secret|secret-provider/u);
    } finally {
      await new Promise<void>((resolve) => upstream.close(() => resolve()));
    }
  });

  it("rejects requests outside the per-bridge token path", async () => {
    const bridge = await getCodexResponsesBridge({
      baseUrl: "http://127.0.0.1:9/v1",
      apiKey: "",
    });
    const result = await fetch(`${bridge.baseUrl.replace(/\/v1$/u, "/../v1/models")}`);
    NodeAssert.equal(result.status, 404);
  });
});
