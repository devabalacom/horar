import type { NextConfig } from "next";

// GitHub Pages serves a static export from /horar/. SELF_HOST builds the same
// static export for the site root, served by the API server (server/) on the
// VPS. Otherwise the standalone output.
const pages = process.env.GITHUB_PAGES === "true";
const selfHost = process.env.SELF_HOST === "true";

const nextConfig: NextConfig = pages
  ? { output: "export", basePath: "/horar", images: { unoptimized: true }, trailingSlash: true }
  : selfHost
    ? { output: "export", images: { unoptimized: true }, trailingSlash: true }
    : { output: "standalone" };

export default nextConfig;
