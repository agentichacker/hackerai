import { defineConfig } from "astro/config";

import { loadRepoEnv } from "../../scripts/lib/public-config.ts";
import { LOCALES } from "./src/i18n/locales.ts";

// Astro loads env with an empty prefix, and under `vp run` Vite+'s loadEnv then reports every
// variable to the task cache. Any env difference (TERM, VP_RAW_SUBCOMMAND, an agent's session
// vars) would rerun `astro check`. Without the runner client, loadEnv reads process.env directly;
// file tracking does not use this client.
delete process.env.VP_RUN_NODE_CLIENT_PATH;

const repoEnv = loadRepoEnv();
Object.assign(process.env, repoEnv);

// Public site configuration, not secrets. Defining it explicitly keeps the same repository on the
// server-rendered pages and inside the client-side download script.
const publicBuildEnv = {
  HACKERAI_RELEASE_REPOSITORY: repoEnv.HACKERAI_RELEASE_REPOSITORY,
  HACKERAI_REPOSITORY: repoEnv.HACKERAI_REPOSITORY,
  GITHUB_REPOSITORY: repoEnv.GITHUB_REPOSITORY,
  HACKERAI_DISCORD_URL: repoEnv.HACKERAI_DISCORD_URL,
  PUBLIC_DISCORD_URL: repoEnv.PUBLIC_DISCORD_URL,
};
const publicBuildDefines = Object.fromEntries(
  Object.entries(publicBuildEnv).map(([name, value]) => [
    `import.meta.env.${name}`,
    JSON.stringify(value?.trim() ?? ""),
  ]),
);

export default defineConfig({
  site: "https://hackerai.sh",
  vite: { define: publicBuildDefines },
  // Vercel 308s `/path/` to `/path` (see vercel.ts), so every internal link and canonical uses one form.
  trailingSlash: "never",
  // English stays unprefixed at `/`; see src/i18n/locales.ts for each locale's URL segment.
  i18n: {
    defaultLocale: "en",
    locales: LOCALES.map(({ code, path }) =>
      !path || path === code ? code : { path, codes: [code] },
    ),
    routing: { prefixDefaultLocale: false },
  },
  server: {
    port: Number(process.env.PORT ?? 4173),
  },
});
