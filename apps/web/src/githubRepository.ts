/** The GitHub owner/repo for this build, or undefined when it was not configured. */
export function parseGitHubRepository(value: string | undefined): string | undefined {
  const repository = value?.trim();
  const match = repository === undefined ? null : /^([\w.-]+)\/([\w.-]+)$/.exec(repository);
  if (match === null) return undefined;
  const [, owner, name] = match;
  return owner === "." || owner === ".." || name === "." || name === ".."
    ? undefined
    : repository;
}

export function configuredGitHubRepository(): string | undefined {
  return parseGitHubRepository(import.meta.env.HACKERAI_REPOSITORY);
}
