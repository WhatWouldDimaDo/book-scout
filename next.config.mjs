/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: import.meta.dirname,
  // Keep framework assets under the app's public mount point so the portfolio
  // reverse proxy does not collide with its own reserved `/_next` namespace.
  assetPrefix: "/dewey",
  async rewrites() {
    return [
      {
        source: "/dewey/_next/:path*",
        destination: "/_next/:path*",
      },
    ];
  },
};

export default nextConfig;
