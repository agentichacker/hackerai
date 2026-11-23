import { createClerkClient } from "@clerk/backend";
import { hmac } from "@noble/hashes/hmac";
import { sha256 } from "@noble/hashes/sha2";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as Base64Url from "effect/encoding/Base64Url";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import { RelayHackerAIChatLink } from "@hackerai/contracts/relay";

import * as RelayConfiguration from "../Config.ts";

const LINK_TOKEN_TTL_SECONDS = 10 * 60;
const HackerAICHAT_REQUEST_TIMEOUT = "5 seconds";

const decodeLinkResponse = Schema.decodeUnknownEffect(
  Schema.Struct({ link: Schema.NullOr(RelayHackerAIChatLink) }),
);

export class HackerAIChatNotConfigured extends Schema.TaggedError<HackerAIChatNotConfigured>()(
  "HackerAIChatNotConfigured",
  {},
) {
  override get message(): string {
    return "HackerAI Chat linking is not configured on this relay";
  }
}

export class ClerkUserLookupFailed extends Schema.TaggedError<ClerkUserLookupFailed>()(
  "ClerkUserLookupFailed",
  { cause: Schema.Defect() },
) {
  override get message(): string {
    return "Could not read the Clerk user's primary email";
  }
}

export class HackerAIChatRequestFailed extends Schema.TaggedError<HackerAIChatRequestFailed>()(
  "HackerAIChatRequestFailed",
  {
    operation: Schema.Literals(["get-link", "unlink"]),
    cause: Schema.Defect(),
  },
) {
  override get message(): string {
    return `HackerAI Chat '${this.operation}' request failed`;
  }
}

/**
 * Bridge to HackerAI Chat. HackerAI Chat owns the account link; the relay
 * signs link requests and asks HackerAI Chat for the linked account's plan.
 */
export class HackerAIChatAccounts extends Context.Service<
  HackerAIChatAccounts,
  {
    readonly available: boolean;
    readonly createLinkUrl: (input: {
      readonly userId: string;
    }) => Effect.Effect<string, HackerAIChatNotConfigured | ClerkUserLookupFailed>;
    readonly getLink: (input: {
      readonly userId: string;
    }) => Effect.Effect<RelayHackerAIChatLink | null, HackerAIChatNotConfigured | HackerAIChatRequestFailed>;
    readonly unlink: (input: {
      readonly userId: string;
    }) => Effect.Effect<void, HackerAIChatNotConfigured | HackerAIChatRequestFailed>;
  }
>()("hackerai-relay/hackeraiChat/HackerAIChatAccounts") {}

/** Token format shared with HackerAI Chat: `<base64url JSON payload>.<base64url HMAC-SHA256>`. */
export const signLinkToken = (
  secret: string,
  payload: { readonly sub: string; readonly email: string; readonly exp: number },
) => {
  const encoded = Base64Url.encode(JSON.stringify({ v: 1, ...payload }));
  const signature = hmac(
    sha256,
    new TextEncoder().encode(secret),
    new TextEncoder().encode(encoded),
  );
  return `${encoded}.${Base64Url.encode(signature)}`;
};

export const make = Effect.gen(function* () {
  const config = yield* RelayConfiguration.RelayConfiguration;
  const client = yield* HttpClient.HttpClient;
  const settings = config.hackeraiChat;

  const requireSettings = settings
    ? Effect.succeed(settings)
    : Effect.fail(new HackerAIChatNotConfigured());

  // The timeout covers the body read so a stalled response still fails fast.
  const post = Effect.fn("relay.hackeraiChat.post")(function* (
    operation: HackerAIChatRequestFailed["operation"],
    path: string,
    userId: string,
  ) {
    const { baseUrl, linkSecret } = yield* requireSettings;
    return yield* HttpClientRequest.post(new URL(path, baseUrl).toString()).pipe(
      HttpClientRequest.bearerToken(Redacted.value(linkSecret)),
      HttpClientRequest.bodyJsonUnsafe({ clerkUserId: userId }),
      client.execute,
      Effect.flatMap(HttpClientResponse.filterStatusOk),
      Effect.flatMap((response) => response.json),
      Effect.timeout(HackerAICHAT_REQUEST_TIMEOUT),
      Effect.mapError((cause) => new HackerAIChatRequestFailed({ operation, cause })),
    );
  });

  const lookupClerkPrimaryEmail = Effect.fn("relay.hackeraiChat.lookup_clerk_primary_email")(function* (
    userId: string,
  ) {
    return yield* Effect.tryPromise({
      try: async () => {
        const user = await createClerkClient({
          secretKey: Redacted.value(config.clerkSecretKey),
          publishableKey: config.clerkPublishableKey,
        }).users.getUser(userId);
        const email = user.primaryEmailAddress?.emailAddress;
        if (!email) throw new Error("Clerk user has no primary email address.");
        return email;
      },
      catch: (cause) => new ClerkUserLookupFailed({ cause }),
    }).pipe(
      Effect.timeoutOrElse({
        duration: HackerAICHAT_REQUEST_TIMEOUT,
        orElse: () => Effect.fail(new ClerkUserLookupFailed({ cause: "timed out" })),
      }),
    );
  });

  return HackerAIChatAccounts.of({
    available: settings !== undefined,
    createLinkUrl: Effect.fn("relay.hackeraiChat.create_link_url")(function* (input) {
      const { baseUrl, linkSecret } = yield* requireSettings;
      const email = yield* lookupClerkPrimaryEmail(input.userId);
      const now = yield* DateTime.now;
      const token = signLinkToken(Redacted.value(linkSecret), {
        sub: input.userId,
        email,
        exp: Math.floor(now.epochMilliseconds / 1_000) + LINK_TOKEN_TTL_SECONDS,
      });
      const url = new URL("/link/hackerai", baseUrl);
      url.searchParams.set("token", token);
      return url.toString();
    }),
    getLink: Effect.fn("relay.hackeraiChat.get_link")(function* (input) {
      const body = yield* post("get-link", "/api/hackerai/link", input.userId);
      const decoded = yield* decodeLinkResponse(body).pipe(
        Effect.mapError((cause) => new HackerAIChatRequestFailed({ operation: "get-link", cause })),
      );
      return decoded.link;
    }),
    unlink: Effect.fn("relay.hackeraiChat.unlink")(function* (input) {
      yield* post("unlink", "/api/hackerai/unlink", input.userId);
    }),
  });
});

export const layer = Layer.effect(HackerAIChatAccounts, make);
