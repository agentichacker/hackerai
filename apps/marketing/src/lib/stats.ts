import { GITHUB_REPOSITORY } from "./site";

// Runs at build time, so each deploy picks up the current count.
async function fetchGithubStars(): Promise<string> {
  if (GITHUB_REPOSITORY === undefined) return "?";
  const token = process.env.GITHUB_TOKEN;
  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new Error(`GitHub API responded ${response.status}`);
    const { stargazers_count: stars } = (await response.json()) as { stargazers_count: number };
    return stars < 1000 ? String(stars) : `${Math.floor(stars / 1000)}k+`;
  } catch (error) {
    // A missing repository must not block local or CI builds.
    console.warn("Could not fetch GitHub stars", error);
    return "?";
  }
}

export const MARKETING_STATS = {
  githubStars: await fetchGithubStars(),
  users: "500,000",
} as const;
