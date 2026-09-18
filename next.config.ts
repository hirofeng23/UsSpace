import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  // Next's dev server blocks cross-origin requests to its internal assets
  // (HMR, _next/*) by default. Without this, opening the "Network" URL
  // (e.g. http://192.168.x.x:3000) from a phone or another computer on the
  // same Wi-Fi loads a blank/broken page even though the initial HTML
  // arrives fine. These patterns cover the common home-router LAN ranges
  // plus mDNS hostnames (e.g. MyMac.local) so any device on the same
  // network can open the app. Requires restarting `npm run dev` to apply.
  allowedDevOrigins: [
    "192.168.*.*",
    "10.*.*.*",
    "172.*.*.*",
    "*.local",
  ],
};

export default nextConfig;
