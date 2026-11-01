/** The main Astro AI site, which the logo and legal links point to. */
export function mainSiteUrl(): string {
  return (process.env.MAIN_SITE_URL ?? "https://aiastro.ru").replace(/\/$/, "");
}
