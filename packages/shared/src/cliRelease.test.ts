import { describe, expect, it } from "vite-plus/test";

import {
  cliArchiveTarCommand,
  cliReleaseBaseUrl,
  cliReleaseRepository,
  cliReleasesPageUrl,
  newestCliReleaseVersion,
  parseChecksums,
} from "./cliRelease.ts";

describe("cliRelease", () => {
  it("parses sha256sum output including binary-mode markers", () => {
    const checksums = parseChecksums(
      [
        `${"a".repeat(64)}  hackerai-1.2.3-linux-x64.tar.gz`,
        `${"B".repeat(64)} *hackerai-1.2.3-win32-x64.zip`,
        "not a checksum line",
        "",
      ].join("\n"),
    );
    expect(checksums.get("hackerai-1.2.3-linux-x64.tar.gz")).toBe("a".repeat(64));
    expect(checksums.get("hackerai-1.2.3-win32-x64.zip")).toBe("b".repeat(64));
    expect(checksums.size).toBe(2);
  });

  it("extracts with the System32 bsdtar on Windows and plain tar elsewhere", () => {
    expect(cliArchiveTarCommand("linux", {})).toBe("tar");
    expect(cliArchiveTarCommand("win32", { SystemRoot: "D:\\Win" })).toBe(
      "D:\\Win\\System32\\tar.exe",
    );
    expect(cliArchiveTarCommand("win32", {})).toBe("C:\\Windows\\System32\\tar.exe");
  });

  it("picks the newest non-draft release on the requested channel", () => {
    const releases = [
      { tag_name: "v1.2.4-preview.20260912.9", draft: true },
      { tag_name: "v1.2.4-preview.20260912.8" },
      { tag_name: "v1.2.4-nightly.20260912.7" },
      { tag_name: "desktop-preview" },
      { tag_name: "v1.2.3" },
      { tag_name: "v1.2.3-nightly.20260911.2" },
    ];
    expect(newestCliReleaseVersion(releases, "preview")).toBe("1.2.4-preview.20260912.8");
    expect(newestCliReleaseVersion(releases, "nightly")).toBe("1.2.4-nightly.20260912.7");
    expect(newestCliReleaseVersion(releases, "stable")).toBe("1.2.3");
    expect(newestCliReleaseVersion([{ tag_name: "v1.2.3" }], "preview")).toBeUndefined();
  });

  it("resolves the configured release source and fails closed without one", () => {
    expect(cliReleaseRepository({})).toBeUndefined();
    expect(cliReleaseRepository({ HACKERAI_RELEASE_REPOSITORY: "../evil" })).toBeUndefined();
    expect(cliReleaseRepository({ HACKERAI_RELEASE_REPOSITORY: "owner/repo" })).toBe("owner/repo");
    expect(cliReleaseRepository({ HACKERAI_REPOSITORY: "owner/source" })).toBe("owner/source");
    expect(
      cliReleaseRepository({
        HACKERAI_RELEASE_REPOSITORY: "owner/releases",
        HACKERAI_REPOSITORY: "owner/source",
      }),
    ).toBe("owner/releases");
    expect(cliReleaseBaseUrl({})).toBeUndefined();
    expect(cliReleaseBaseUrl({ HACKERAI_RELEASE_REPOSITORY: "owner/repo" })).toBe(
      "https://github.com/owner/repo/releases/download",
    );
    expect(
      cliReleaseBaseUrl({
        HACKERAI_RELEASE_REPOSITORY: "owner/repo",
        HACKERAI_RELEASE_BASE_URL: "https://mirror.example.com/hackerai/",
      }),
    ).toBe("https://mirror.example.com/hackerai");
    expect(cliReleasesPageUrl("owner/repo")).toBe("https://github.com/owner/repo/releases");
  });
});
