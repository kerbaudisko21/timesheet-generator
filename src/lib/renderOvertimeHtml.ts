import { MANDIRI_LOGO_DATA_URL } from "@/assets/logo";
import { overtimeEntries } from "./timesheet";
import { Timesheet } from "./types";

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtHours(n: number): string {
  // 5 -> "5", 5.5 -> "5.5"
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/**
 * Render "Surat Keterangan Kerja Lembur" meniru template Word Mandiri.
 * Dipakai untuk preview di browser dan sumber konversi PDF.
 */
export function renderOvertimeHtml(
  ts: Timesheet,
  opts?: { forPdf?: boolean }
): string {
  const forPdf = opts?.forPdf ?? false;
  const p = ts.profile;
  const entries = overtimeEntries(ts);
  const unitKerja = p.mainProjectName || "";

  const rows = entries
    .map(
      (e, i) => `<tr>
      ${
        i === 0
          ? `<td class="c-name" rowspan="${entries.length}">${esc(p.name)}</td>`
          : ""
      }
      <td class="c-date">${esc(e.dayLabel)}</td>
      <td class="c-unit">${esc(unitKerja)}</td>
      <td class="c-window">${esc(e.windowLabel)}</td>
      <td class="c-total">${fmtHours(e.totalHours)}</td>
      <td class="c-work">${esc(e.work)}</td>
    </tr>`
    )
    .join("\n");

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>Surat Lembur ${esc(p.name)}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: ${forPdf ? "#fff" : "#e9edf2"}; }
  body {
    font-family: "Times New Roman", Georgia, serif;
    color: #000;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .sheet {
    width: 210mm;
    min-height: 297mm;
    margin: ${forPdf ? "0" : "24px auto"};
    padding: 22mm 20mm;
    background: #fff;
    ${forPdf ? "" : "box-shadow: 0 2px 16px rgba(0,0,0,.15);"}
  }
  .logo-row { text-align: right; margin-bottom: 18px; }
  .logo-row img { width: 150px; height: auto; }
  h1 {
    text-align: center;
    font-size: 13px;
    font-weight: bold;
    letter-spacing: .3px;
    margin: 0 0 18px;
    text-transform: uppercase;
  }
  p.intro {
    font-size: 11.5px;
    text-align: justify;
    line-height: 1.5;
    margin: 0 0 16px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10.5px;
    table-layout: fixed;
  }
  th, td {
    border: 1px solid #000;
    padding: 3px 5px;
    vertical-align: middle;
  }
  thead th {
    background: #b9cce4;
    text-align: center;
    font-weight: bold;
    line-height: 1.2;
  }
  .c-name { width: 62px; text-align: center; vertical-align: middle; }
  .c-date { width: 96px; text-align: center; }
  .c-unit { width: 52px; text-align: center; }
  .c-window { width: 84px; text-align: center; }
  .c-total { width: 46px; text-align: center; }
  .c-work { text-align: left; }
  tbody td { line-height: 1.3; }
  .sign {
    display: flex;
    margin-top: 42px;
    font-size: 11.5px;
    text-align: center;
  }
  .sign > div { flex: 1; }
  .sign .head { margin-bottom: 60px; }
  .sign .sig-img {
    display: block;
    height: 46px;
    margin: -50px auto 4px;
  }
  .sign .who { font-weight: bold; text-decoration: underline; }
  .sign .role { }
  .empty {
    margin-top: 30px;
    font-size: 11.5px;
    font-style: italic;
    color: #444;
  }
  @page { size: A4 portrait; margin: 0; }
</style>
</head>
<body>
<div class="sheet">
  <div class="logo-row">
    <img src="${MANDIRI_LOGO_DATA_URL}" alt="Mandiri MCO" />
  </div>

  <h1>Surat Keterangan Kerja Lembur</h1>

  <p class="intro">
    Sehubung dengan adanya tugas pekerjaan dan/atau kegiatan kedinasan yang
    tidak dapat ditunda/ditangguhkan, sehingga membutuhkan penyelesaian dengan
    segera. Dengan ini, kami menginformasikan kepada pegawai yang tercantum
    dalam daftar dibawah ini yang menyelesaikan kerja lembur.
  </p>

  ${
    entries.length === 0
      ? `<p class="empty">Tidak ada hari lembur pada periode ini.</p>`
      : `<table>
    <colgroup>
      <col class="c-name" /><col class="c-date" /><col class="c-unit" />
      <col class="c-window" /><col class="c-total" /><col />
    </colgroup>
    <thead>
      <tr>
        <th>Nama</th>
        <th>Hari/Tanggal</th>
        <th>Unit Kerja</th>
        <th>Waktu Lembur</th>
        <th>Total Lembur (Jam)</th>
        <th>Pekerjaan yang harus dikerjakan</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>`
  }

  <div class="sign">
    <div>
      <div class="head">Pemohon</div>
      ${
        p.signatureDataUrl
          ? `<img class="sig-img" src="${p.signatureDataUrl}" alt="ttd pemohon" />`
          : ""
      }
      <div class="who">${esc(p.name)}</div>
      <div class="role">${esc(p.position)}</div>
    </div>
    <div>
      <div class="head">Disetujui Oleh</div>
      <div class="who">${esc(p.teamLeadName)}</div>
      <div class="role">${esc(p.teamLeadTitle)}</div>
    </div>
  </div>
</div>
</body>
</html>`;
}
