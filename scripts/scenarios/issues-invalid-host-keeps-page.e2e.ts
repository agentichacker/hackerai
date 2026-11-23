import { expect } from "e2e";

import { test, WEB } from "./hackerai.ts";

test("An invalid host filter keeps the Issues page open", WEB, async ({ hackerai, app, browser }) => {
  await hackerai.project("demo");
  await hackerai.open("/issues?host=true");

  await app.screenshot("issues-invalid-host");
  await expect(browser.locator("h1")).toHaveText("Issues");
});
