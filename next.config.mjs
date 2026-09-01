/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      "@sparticuz/chromium-min",
      "puppeteer-core",
      "puppeteer",
      "exceljs",
    ],
  },
};

export default nextConfig;
