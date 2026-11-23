import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

const marketingDir = NodePath.dirname(NodePath.dirname(NodeURL.fileURLToPath(import.meta.url)));
const repoRoot = NodePath.dirname(NodePath.dirname(marketingDir));
const publicDir = NodePath.join(marketingDir, "public");
NodeFS.mkdirSync(publicDir, { recursive: true });

// The published installers need a default release source: the download page tells
// visitors to pipe them straight into a shell, where nobody sets
// HACKERAI_RELEASE_REPOSITORY. Keep the source scripts fail-closed and bake the
// configured repository into the hosted copies only.
const repository = (
  process.env.HACKERAI_RELEASE_REPOSITORY ||
  process.env.HACKERAI_REPOSITORY ||
  ""
).trim();
if (repository !== "") {
  const match = /^([\w.-]+)\/([\w.-]+)$/.exec(repository);
  if (match === null || [match[1], match[2]].some((part) => part === "." || part === "..")) {
    throw new Error(
      `HACKERAI_RELEASE_REPOSITORY must be a GitHub owner/repo, got ${JSON.stringify(repository)}`,
    );
  }
}

const shRepositoryFallback = 'repo="${HACKERAI_RELEASE_REPOSITORY:-${HACKERAI_REPOSITORY:-}}"';
const ps1RepositoryFallback = [
  '$repo = if ($env:HACKERAI_RELEASE_REPOSITORY) {',
  "  $env:HACKERAI_RELEASE_REPOSITORY.Trim()",
  "} elseif ($env:HACKERAI_REPOSITORY) {",
  "  $env:HACKERAI_REPOSITORY.Trim()",
  "} else {",
  '  ""',
  "}",
].join("\n");

for (const name of ["install.sh", "install.ps1"]) {
  const source = NodeFS.readFileSync(NodePath.join(repoRoot, "scripts", name), "utf8");
  let staged = source;
  if (repository !== "") {
    staged =
      name === "install.sh"
        ? source.replace(
            shRepositoryFallback,
            `repo="\${HACKERAI_RELEASE_REPOSITORY:-\${HACKERAI_REPOSITORY:-${repository}}}"`,
          )
        : source.replace(
            ps1RepositoryFallback,
            ps1RepositoryFallback.replace('  ""', `  "${repository}"`),
          );
    if (staged === source) {
      throw new Error(`could not find the release repository assignment in scripts/${name}`);
    }
  }
  NodeFS.writeFileSync(NodePath.join(publicDir, name), staged);
}
