import type { APIRoute } from "astro";

import { GITHUB_REPOSITORY_URL } from "../lib/site";
import { absoluteUrl, SITE_TAGLINE } from "../lib/seo";

// https://llmstxt.org: a plain index that tells AI agents which domain and links are official.
export const GET: APIRoute = () => {
  const releasesUrl =
    GITHUB_REPOSITORY_URL === undefined ? "" : `, ${GITHUB_REPOSITORY_URL}/releases`;
  const repositoryLinks =
    GITHUB_REPOSITORY_URL === undefined
      ? ""
      : `- [Source code](${GITHUB_REPOSITORY_URL}): the MIT-licensed repository
- [Releases](${GITHUB_REPOSITORY_URL}/releases): release builds and changelogs
- [npm package](https://www.npmjs.com/package/@hackerai/cli): run \`npx @hackerai/cli@latest\`
`;
  const body = `# HackerAI

> ${SITE_TAGLINE}. HackerAI is free, MIT-licensed, and built by HackerAI Inc. It runs Claude Code, Codex, Cursor, OpenCode, Grok, Antigravity, and other coding agents from one desktop and web app.

HackerAI is a free, open-source control plane for coding agents. It works with the agents already installed and signed in on your machine, including Claude Code, Codex, Cursor, OpenCode, Grok Build, Antigravity, Kiro, Pi, Muse Code, fx, and any Agent Client Protocol (ACP) agent. There is no token resale and no subscription markup: you bring your own provider subscription or API key. HackerAI runs on macOS, Windows, and Linux, and the same threads are available on desktop, web, and phone.

The only official websites are https://hackerai.sh and the web app at https://hackerai.sh. Official builds come from ${absoluteUrl("/download")}${releasesUrl}, and the \`@hackerai/cli\` package on npm (\`npx @hackerai/cli@latest\`). Any other website that offers a HackerAI download is not affiliated with HackerAI Inc.

## Official links

- [Download HackerAI](${absoluteUrl("/download")}): macOS, Windows, and Linux installers
- [Web app](https://hackerai.sh): connect to a HackerAI server from a browser
- [FAQ](${absoluteUrl("/faq")}): supported agents, pricing, platforms, and privacy
${repositoryLinks}
## Policies

- [Security policy](${absoluteUrl("/security-policy")})
- [Privacy policy](${absoluteUrl("/privacy-policy")})
- [Terms of service](${absoluteUrl("/terms-of-service")})
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
