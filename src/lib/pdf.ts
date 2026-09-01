import type { Browser } from "puppeteer-core";

/**
 * Chromium pack yang sudah dikompilasi utk lingkungan serverless (Vercel/Lambda).
 * Versi tar HARUS sama persis dengan versi @sparticuz/chromium-min di package.json.
 * Bisa dioverride lewat env CHROMIUM_PACK_URL bila mau host tar sendiri.
 */
const CHROMIUM_PACK_URL =
  process.env.CHROMIUM_PACK_URL ||
  "https://github.com/Sparticuz/chromium/releases/download/v133.0.0/chromium-v133.0.0-pack.tar";

function isServerless(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    !!process.env.VERCEL ||
    !!process.env.AWS_LAMBDA_FUNCTION_NAME
  );
}

async function launchBrowser(): Promise<Browser> {
  if (isServerless()) {
    const chromium = (await import("@sparticuz/chromium-min")).default;
    const puppeteer = await import("puppeteer-core");

    const executablePath = await chromium.executablePath(CHROMIUM_PACK_URL);

    return puppeteer.launch({
      executablePath,
      args: [
        ...chromium.args,
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--single-process",
      ],
      defaultViewport: chromium.defaultViewport,
      headless: true,
    }) as unknown as Promise<Browser>;
  }

  // Lokal: pakai puppeteer penuh (Chrome-nya diunduh sendiri saat npm install)
  const puppeteer = await import("puppeteer");
  return puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  }) as unknown as Promise<Browser>;
}

export async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    // HTML sudah self-contained (logo base64, tanpa request eksternal) -> "load" cukup
    await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
