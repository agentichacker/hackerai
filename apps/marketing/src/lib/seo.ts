import { DISCORD_URL, GITHUB_REPOSITORY_URL } from "./site";

export const SITE_ORIGIN = "https://hackerai.sh";
export const SITE_NAME = "HackerAI";
export const SITE_TAGLINE = "The open-source control plane for coding agents";

// The canonical set of official properties. Search engines and AI answer engines read `sameAs`
// to tie an entity to its real homes, which is the signal a look-alike domain cannot copy.
export const OFFICIAL_PROFILES = [GITHUB_REPOSITORY_URL, DISCORD_URL].filter(
  (url): url is string => url !== undefined,
);

export type JsonLd = Record<string, unknown>;

const ORGANIZATION_ID = `${SITE_ORIGIN}/#organization`;
const WEBSITE_ID = `${SITE_ORIGIN}/#website`;
const SOFTWARE_ID = `${SITE_ORIGIN}/#software`;

export const absoluteUrl = (pathname: string): string => new URL(pathname, SITE_ORIGIN).href;

export const organizationJsonLd = (): JsonLd => ({
  "@type": "Organization",
  "@id": ORGANIZATION_ID,
  name: "HackerAI Inc",
  url: SITE_ORIGIN,
  logo: absoluteUrl("/apple-touch-icon.png"),
  sameAs: OFFICIAL_PROFILES,
});

export const websiteJsonLd = (): JsonLd => ({
  "@type": "WebSite",
  "@id": WEBSITE_ID,
  name: SITE_NAME,
  url: SITE_ORIGIN,
  publisher: { "@id": ORGANIZATION_ID },
});

export const softwareJsonLd = (description: string): JsonLd => ({
  "@type": "SoftwareApplication",
  "@id": SOFTWARE_ID,
  name: SITE_NAME,
  description,
  url: SITE_ORIGIN,
  downloadUrl: absoluteUrl("/download"),
  applicationCategory: "DeveloperApplication",
  operatingSystem: "macOS, Windows, Linux",
  license: "https://opensource.org/license/mit",
  isAccessibleForFree: true,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "One interface for Claude Code, Codex, Cursor, OpenCode, Grok, Antigravity, and other coding agents",
    "Bring your own subscription or API key",
    "Git worktrees, inline diff review, and one-click pull requests",
    "Remote access from desktop, phone, and browser",
    "MIT licensed, self-hostable, and forkable",
  ],
  publisher: { "@id": ORGANIZATION_ID },
  sameAs: OFFICIAL_PROFILES,
});

export const faqJsonLd = (
  items: ReadonlyArray<{ question: string; answer: string }>,
): JsonLd => ({
  "@type": "FAQPage",
  mainEntity: items.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
});

export const breadcrumbJsonLd = (items: ReadonlyArray<{ name: string; path: string }>): JsonLd => ({
  "@type": "BreadcrumbList",
  itemListElement: items.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: item.name,
    item: absoluteUrl(item.path),
  })),
});

export const jsonLdGraph = (nodes: ReadonlyArray<JsonLd>): string =>
  // `<` is escaped so page text inside the graph can never close the script tag.
  JSON.stringify({ "@context": "https://schema.org", "@graph": nodes }).replace(/</g, "\\u003c");

// Indexable static pages. The 404 (noindex) and the /95 easter egg stay out of the sitemap.
export const STATIC_PAGES = [
  { path: "/", priority: "1.0" },
  { path: "/download", priority: "0.9" },
  { path: "/faq", priority: "0.7" },
  { path: "/legal", priority: "0.3" },
  { path: "/privacy-policy", priority: "0.3" },
  { path: "/security-policy", priority: "0.3" },
  { path: "/terms-of-service", priority: "0.3" },
] as const;
