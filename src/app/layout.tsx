import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Timesheet Generator — Mandiri",
  description:
    "Buat timesheet bulanan format Mandiri dengan cepat. Export ke XLSX & PDF.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
