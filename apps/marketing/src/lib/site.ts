const configuredRepository = (
  import.meta.env.HACKERAI_RELEASE_REPOSITORY?.trim() ||
  import.meta.env.HACKERAI_REPOSITORY?.trim() ||
  import.meta.env.GITHUB_REPOSITORY?.trim() ||
  ""
).trim();

const match = /^([\w.-]+)\/([\w.-]+)$/.exec(configuredRepository);
const owner = match?.[1];
const name = match?.[2];
const isRepositoryName = (value: string | undefined) =>
  value !== undefined && value !== "." && value !== "..";

/** The GitHub owner/repo that publishes this build, or undefined when the build has no source. */
export const GITHUB_REPOSITORY =
  match && isRepositoryName(owner) && isRepositoryName(name) ? configuredRepository : undefined;

export const GITHUB_REPOSITORY_URL =
  GITHUB_REPOSITORY === undefined ? undefined : `https://github.com/${GITHUB_REPOSITORY}`;

export const GITHUB_FORK_URL =
  GITHUB_REPOSITORY_URL === undefined ? undefined : `${GITHUB_REPOSITORY_URL}/fork`;

export const DISCORD_URL =
  import.meta.env.HACKERAI_DISCORD_URL?.trim() ||
  import.meta.env.PUBLIC_DISCORD_URL?.trim() ||
  undefined;
