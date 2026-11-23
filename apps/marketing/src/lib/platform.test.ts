import { expect, it } from "vite-plus/test";

import { detectPlatform } from "./platform";

it.each([
  {
    name: "Windows",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36",
    os: "win",
  },
  {
    name: "macOS",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.6 Safari/605.1.15",
    os: "mac",
  },
  {
    name: "Linux",
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36",
    os: "linux",
  },
])("$name visitors get the $os download", ({ userAgent, os }) => {
  expect(detectPlatform(userAgent)?.os).toBe(os);
});
