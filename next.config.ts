import type { NextConfig } from "next";

// GitHub Pages serves a static export from /horar/; the server build keeps
// the standalone output for the VPS.
const pages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = pages
  ? { output: "export", basePath: "/horar", images: { unoptimized: true }, trailingSlash: true }
  : { output: "standalone" };

export default nextConfig;
