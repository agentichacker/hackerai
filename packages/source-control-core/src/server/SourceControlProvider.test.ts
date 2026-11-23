import { assert, it } from "@effect/vitest";

import {
  repositoryPathFromRemoteUrl,
  transportSafeSourceControlErrorValue,
} from "./SourceControlProvider.ts";

it("removes URL credentials, query parameters, and fragments from error transport values", () => {
  assert.strictEqual(
    transportSafeSourceControlErrorValue(
      "https://user:secret@example.test/org/repo/pull/42?token=secret#discussion",
    ),
    "https://example.test/org/repo/pull/42",
  );
});

it.each([
  ["git@github.com:HackerAI/hackerai.git", "HackerAI/hackerai"],
  ["github.com:HackerAI/hackerai.git", "HackerAI/hackerai"],
  ["gitlab.com:HackerAI/platform/hackerai", "HackerAI/platform/hackerai"],
  ["https://github.com/HackerAI/hackerai.git", "HackerAI/hackerai"],
  ["https://github.com/HackerAI/hackerai.git?view=compact", "HackerAI/hackerai"],
  ["https://github.com/HackerAI/hackerai.git#section", "HackerAI/hackerai"],
  ["C:/repos/hackerai", null],
])("reads the repository path of %s", (remoteUrl, expected) => {
  assert.strictEqual(repositoryPathFromRemoteUrl(remoteUrl), expected);
});
