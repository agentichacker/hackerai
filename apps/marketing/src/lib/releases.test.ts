import { afterEach, describe, expect, it, vi } from "vite-plus/test";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("fetchLatestRelease", () => {
  it("rejects a GitHub API error response instead of returning it as a release", async () => {
    vi.stubEnv("HACKERAI_REPOSITORY", "example/hackerai");
    const { fetchLatestRelease } = await import("./releases");
    vi.stubGlobal("sessionStorage", { getItem: () => null });
    vi.stubGlobal("fetch", async () =>
      Response.json({ message: "API rate limit exceeded" }, { status: 403 }),
    );

    await expect(fetchLatestRelease("stable")).rejects.toThrow("403");
  });

  it("fails closed when no release repository is configured", async () => {
    // GitHub Actions sets GITHUB_REPOSITORY, so clear every source the site reads.
    vi.stubEnv("HACKERAI_RELEASE_REPOSITORY", "");
    vi.stubEnv("HACKERAI_REPOSITORY", "");
    vi.stubEnv("GITHUB_REPOSITORY", "");
    const { fetchLatestRelease } = await import("./releases");

    await expect(fetchLatestRelease("stable")).rejects.toThrow(
      "No release repository is configured",
    );
  });
});
