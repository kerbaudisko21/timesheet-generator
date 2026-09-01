# Timesheet Generator (format Mandiri)

Web app untuk membuat timesheet bulanan sesuai format **Template Timesheet Mandiri**,
lalu export ke **XLSX** (mengisi template asli) dan **PDF**.

- Next.js 14 (App Router) + TypeScript
- Data tersimpan di **localStorage** — tidak ada database, tidak ada login
- Weekend terisi otomatis, tombol "isi semua hari kerja", aktivitas bisa disalin
- Preview A4 real-time di sebelah form
- Siap deploy ke **Vercel**

## Menjalankan lokal

```bash
npm install
npm run dev
```

Buka http://localhost:3000

> Saat `npm install` pertama, package `puppeteer` mengunduh Chromium (~150 MB) untuk
> render PDF di lokal. Di Vercel dipakai `@sparticuz/chromium` yang jauh lebih kecil.

## Cara pakai

1. **Profil** — isi sekali: nama, Employee ID, posisi, nama DH & Team Lead, dst.
   Upload gambar tanda tangan pegawai (PNG/JPG). Semua tersimpan di browser.
   Blok tanda tangan di output = 3 kolom: **Pegawai | DH | Team Lead**
   (DH & Team Lead cukup nama, ditandatangani basah setelah dicetak).
2. **Periode** — pilih bulan. Weekend otomatis ditandai.
3. **Aktivitas Harian** — untuk tiap hari kerja pilih status (Hari Kerja / Cuti / Izin /
   Sakit / Libur / Belum Masuk) dan isi jam + aktivitas. Pakai tombol
   *Isi semua hari kerja 09:00–18:00* untuk mempercepat.
4. **Pernyataan & Penilaian** — teks pernyataan + 3 rating (default "Sangat Memuaskan").
5. Klik **Download XLSX** atau **Download PDF** di kanan atas.

## Struktur

| Path | Isi |
|---|---|
| `src/lib/types.ts` | Model data timesheet |
| `src/lib/timesheet.ts` | Kalkulasi hari/jam, default bulanan, rekap |
| `src/lib/renderHtml.ts` | Render HTML meniru layout PDF Mandiri (dipakai preview + PDF) |
| `src/lib/fillXlsx.ts` | Bangun workbook XLSX dari nol (ExcelJS), meniru layout PDF |
| `src/lib/pdf.ts` | HTML → PDF via Puppeteer (Chromium) |
| `src/app/api/export/xlsx` | Endpoint download XLSX |
| `src/app/api/export/pdf` | Endpoint download PDF |
| `src/assets/logo.ts` | Logo Mandiri MCO (base64, di-extract dari PDF contoh) |

## Deploy ke Vercel

```bash
npm i -g vercel
vercel
```

Tidak perlu env var. `@sparticuz/chromium` sudah terdeteksi lewat
`experimental.serverComponentsExternalPackages` di `next.config.mjs`.
Route PDF di-set `maxDuration = 60`.

## Catatan

- Template XLSX yang diisi tetap memakai **formula** milik template (Total Hours, %
  kehadiran, dll) sehingga tetap benar bila dibuka di Excel.
- Rating pada XLSX ditandai dengan huruf `V` di kolom pengecek baris rating.
- Bulan < 31 hari: baris tanggal sisa pada template dikosongkan otomatis.
