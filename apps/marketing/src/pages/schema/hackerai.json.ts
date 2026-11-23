import type { APIRoute } from "astro";

import { buildHackerAIProjectFileJsonSchema } from "@hackerai/shared/hackeraiProjectFile";

export const GET: APIRoute = () =>
  new Response(`${JSON.stringify(buildHackerAIProjectFileJsonSchema(), null, 2)}\n`, {
    headers: { "Content-Type": "application/json" },
  });
