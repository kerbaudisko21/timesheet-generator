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
4. **Pernyataan Pegawai** — teks pernyataan. Bagian "Penilaian User" dibiarkan
   kosong (diisi TL).
5. **Lembur** — otomatis: tiap hari kerja > 9 jam jadi baris lembur. Jam mulai
   lembur = jam masuk + 9 jam, total dibulatkan ke 0,5 jam terdekat, Unit Kerja
   = Main Project Name. Klik **Download Surat Lembur (PDF)**.
6. Klik **Download XLSX** atau **Download PDF** di kanan atas.

## Struktur

| Path | Isi |
|---|---|
| `src/lib/types.ts` | Model data timesheet |
| `src/lib/timesheet.ts` | Kalkulasi hari/jam, default bulanan, rekap |
| `src/lib/renderHtml.ts` | Render HTML timesheet meniru layout PDF Mandiri |
| `src/lib/renderOvertimeHtml.ts` | Render HTML "Surat Keterangan Kerja Lembur" |
| `src/lib/fillXlsx.ts` | Bangun workbook XLSX dari nol (ExcelJS), meniru layout PDF |
| `src/lib/pdf.ts` | HTML → PDF via Puppeteer (Chromium) |
| `src/app/api/export/xlsx` | Endpoint download XLSX timesheet |
| `src/app/api/export/pdf` | Endpoint download PDF timesheet |
| `src/app/api/export/lembur` | Endpoint download PDF surat lembur |
| `src/assets/logo.ts` | Logo Mandiri MCO (base64, di-extract dari PDF contoh) |

## Deploy ke Vercel

```bash
npm i -g vercel
vercel
```

Tidak perlu env var.

**PDF di serverless** memakai `@sparticuz/chromium-min`: binary Chromium + shared
library (`libnss3.so`, dll) **tidak di-bundle**, tapi diunduh saat runtime dari
GitHub release pack (`chromium-v133.0.0-pack.tar`, ~63 MB, di-cache di `/tmp`).
Ini menghindari error `libnss3.so: cannot open shared object file` yang muncul
kalau pakai `@sparticuz/chromium` biasa (file tracing Next gagal ikut sertakan
`.so`-nya).

- Versi `@sparticuz/chromium-min` di `package.json` **harus sama persis** dengan
  versi tar di `src/lib/pdf.ts` (`CHROMIUM_PACK_URL`).
- Mau host tar sendiri (mis. di Vercel Blob / R2)? Set env `CHROMIUM_PACK_URL`.
- `vercel.json`: route PDF `memory: 1769 MB`, `maxDuration: 60`.
- Lokal (`npm run dev`) tetap pakai `puppeteer` penuh (Chrome-nya terunduh saat
  `npm install`).

## Catatan

- Template XLSX yang diisi tetap memakai **formula** milik template (Total Hours, %
  kehadiran, dll) sehingga tetap benar bila dibuka di Excel.
- Rating pada XLSX ditandai dengan huruf `V` di kolom pengecek baris rating.
- Bulan < 31 hari: baris tanggal sisa pada template dikosongkan otomatis.
