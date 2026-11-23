export type Platform = { os: "mac" | "win" | "linux" };

export function detectPlatform(userAgent: string): Platform | null {
  if (/Win/i.test(userAgent)) return { os: "win" };
  if (/Mac/i.test(userAgent)) return { os: "mac" };
  if (/Linux/i.test(userAgent)) return { os: "linux" };
  return null;
}
