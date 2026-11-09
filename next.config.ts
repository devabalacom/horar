import type { NextConfig } from "next";

// SELF_HOST builds a static export for the site root, served together with
// the API by server/ on the VPS (deploy/update.sh). Otherwise the standalone output.
const selfHost = process.env.SELF_HOST === "true";

const nextConfig: NextConfig = selfHost
  ? { output: "export", images: { unoptimized: true }, trailingSlash: true }
  : { output: "standalone" };

export default nextConfig;
