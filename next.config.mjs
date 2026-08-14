/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: import.meta.dirname,
  // The portfolio mounts this app at `/dewey`, but Vercel reserves `/_next`
  // before external rewrites run. Load immutable framework assets from the
  // canonical app origin so both the direct and proxied pages stay styled.
  assetPrefix: process.env.NODE_ENV === "production" ? "https://deweybooks.vercel.app" : undefined,
};

export default nextConfig;
