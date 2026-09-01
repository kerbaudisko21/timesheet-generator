import { MANDIRI_LOGO_DATA_URL } from "@/assets/logo";
import {
  activityLines,
  autoActivityFor,
  dayName,
  formatTotalHours,
  monthLabel,
  pad2,
  shortPeriode,
  summarize,
  toMinutes,
  workedMinutes,
} from "./timesheet";
import { DayEntry, Timesheet } from "./types";

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(dateIso: string): string {
  const [, m, d] = dateIso.split("-").map(Number);
  const mon = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ][m - 1];
  const [y] = dateIso.split("-");
  return `${pad2(d)}-${mon}-${y}`;
}

function hhmm(v: string): string {
  if (!v) return "";
  const mins = toMinutes(v);
  const h = Math.floor(mins / 60);
  const mm = mins % 60;
  return `${h}:${pad2(mm)}`;
}

function rowClass(day: DayEntry): string {
  switch (day.status) {
    case "weekend":
      return "row-weekend";
    case "holiday":
      return "row-holiday";
    case "leave":
    case "permit":
    case "sick":
      return "row-leave";
    case "absent":
      return "row-absent";
    default:
      return "";
  }
}

/** HTML aktivitas: multi-baris jadi <br>, auto-nomor bila >= 2 baris */
function activityHtml(day: DayEntry): string {
  if (day.activity && day.activity.trim()) {
    const lines = activityLines(day.activity);
    if (lines.length <= 1) return esc(lines[0] ?? day.activity.trim());
    return `<span class="act-list">${lines
      .map((l) => esc(l))
      .join("<br />")}</span>`;
  }
  if (day.status !== "work") return esc(autoActivityFor(day.status, day.date));
  return "";
}

// Kotak penilaian sengaja dibiarkan KOSONG — diisi manual oleh Team Lead.
function ratingRow(label: string) {
  return `<div class="rate-line"><span>${esc(label)}</span><span class="rate-box"></span></div>`;
}

const RATING_OPTIONS = [
  "Sangat Memuaskan",
  "Memuaskan",
  "Tidak Memuaskan",
  "Sangat tidak memuaskan",
];

/**
 * Render satu halaman timesheet meniru format "Template Timesheet Mandiri".
 * Dipakai untuk preview di browser dan sumber untuk konversi PDF.
 */
export function renderTimesheetHtml(ts: Timesheet, opts?: { forPdf?: boolean }): string {
  const s = summarize(ts);
  const p = ts.profile;
  const forPdf = opts?.forPdf ?? false;

  const infoRows: [string, string][] = [
    ["Name", p.name],
    ["Employee ID", p.employeeId],
    ["Position", p.position],
    ["Placement", p.placement],
    ["Location", p.location],
    ["Main Project Name", p.mainProjectName],
    ["Project Code", p.projectCode],
    ["Activity Code", p.activityCode],
    ["PM / Contact", p.pmContact],
    ["Periode", shortPeriode(ts.month)],
  ];

  const dayRows = ts.days
    .map((d) => {
      const worked = workedMinutes(d);
      const start = d.status === "work" ? hhmm(d.start) : "";
      const end = d.status === "work" ? hhmm(d.end) : "";
      const total = worked > 0 ? formatTotalHours(worked) : "";
      return `<tr class="${rowClass(d)}">
        <td class="c-date">${fmtDate(d.date)}</td>
        <td class="c-hour">${start}</td>
        <td class="c-sep">${start ? "-" : ""}</td>
        <td class="c-hour">${end}</td>
        <td class="c-total">${total}</td>
        <td class="c-act">${activityHtml(d)}</td>
      </tr>`;
    })
    .join("\n");

  const pct = (v: number) => `${Math.round(v * 100)}%`;

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>Timesheet ${esc(p.name)} ${esc(monthLabel(ts.month))}</title>
<style>
  :root { --pink:#f2c4c4; --pink-strong:#e8a9a9; --line:#000; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: ${forPdf ? "#fff" : "#e9edf2"}; }
  body { font-family: Tahoma, "DejaVu Sans", Arial, sans-serif; color: #111; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .sheet {
    width: 210mm;
    min-height: 297mm;
    margin: ${forPdf ? "0" : "24px auto"};
    padding: 10mm 6mm 8mm 7mm;
    background: #fff;
    ${forPdf ? "" : "box-shadow: 0 2px 16px rgba(0,0,0,.15);"}
  }
  .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
  table.info { border-collapse: collapse; font-size: 9px; border: 1px solid var(--line); }
  table.info td { padding: 1px 4px; vertical-align: top; }
  table.info td.k { width: 120px; }
  table.info td.s { width: 10px; text-align: center; }
  .logo { width: 150px; height: auto; }
  table.grid { border-collapse: collapse; width: 100%; margin-top: 10px; font-size: 8px; table-layout: fixed; }
  table.grid th, table.grid td { border: 1px solid var(--line); padding: 1px 3px; }
  table.grid thead th { text-align: center; font-weight: normal; }
  .c-date { width: 62px; text-align: center; }
  .c-hour { width: 34px; text-align: center; }
  .c-sep  { width: 10px; text-align: center; border-left: none; border-right: none; }
  .c-total { width: 40px; text-align: center; }
  .c-act { text-align: center; }
  .c-act .act-list { display: block; text-align: left; line-height: 1.4; padding-left: 6px; }
  tbody tr { height: 14px; }
  tbody td { vertical-align: middle; }
  .row-weekend td, .row-holiday td, .row-leave td, .row-absent td { background: var(--pink); text-align: center; }
  .row-weekend .c-act, .row-holiday .c-act, .row-leave .c-act, .row-absent .c-act { font-style: normal; }
  tr.total-row td { font-weight: bold; text-align: center; background: #fff; }
  tr.total-row td.lbl { text-align: center; }
  .bottom { display: flex; margin-top: 0; font-size: 9px; }
  .bottom .left { width: 44%; border: 1px solid var(--line); border-top: none; }
  .bottom .right { width: 56%; border: 1px solid var(--line); border-top: none; border-left: none; }
  .bottom .left .brow { display: flex; justify-content: space-between; padding: 1px 4px; border-bottom: 1px solid #bbb; }
  .bottom .left .brow:last-child { border-bottom: none; }
  .bottom .left .head { font-weight: bold; background: #f3f3f3; }
  .pad { padding: 4px 6px; }
  .stmt { font-style: italic; }
  .rate-cols { display: flex; gap: 6px; margin-top: 4px; }
  .rate-col { flex: 1; border: 1px solid var(--line); }
  .rate-col h4 { margin: 0; padding: 2px 4px; font-size: 8.5px; background: #f3f3f3; border-bottom: 1px solid var(--line); }
  .rate-line { display: flex; justify-content: space-between; align-items: center; padding: 1px 4px; font-size: 8px; }
  .rate-box { width: 10px; height: 10px; border: 1px solid var(--line); display: inline-block; }
  .rate-box.checked { background: #333; }
  .sign { display: flex; margin-top: 2px; font-size: 9px; }
  .sign > div { flex: 1; border: 1px solid var(--line); border-top: none; text-align: center; padding: 4px 6px; min-height: 96px; display: flex; flex-direction: column; }
  .sign > div + div { border-left: none; }
  .sign .sig-head { min-height: 12px; }
  .sign .sig-img { height: 46px; margin: 4px auto 2px; display: block; max-width: 90%; object-fit: contain; }
  .sign .spacer { flex: 1; min-height: 44px; }
  .sign .who { margin-top: auto; font-weight: bold; padding-top: 2px; }
  @page { size: A4 portrait; margin: 0; }
</style>
</head>
<body>
<div class="sheet">
  <div class="top">
    <table class="info">
      ${infoRows
        .map(
          ([k, v]) =>
            `<tr><td class="k">${esc(k)}</td><td class="s">:</td><td>${esc(v)}</td></tr>`
        )
        .join("\n")}
    </table>
    <img class="logo" src="${MANDIRI_LOGO_DATA_URL}" alt="Mandiri MCO" />
  </div>

  <table class="grid">
    <colgroup>
      <col class="c-date" /><col class="c-hour" /><col class="c-sep" />
      <col class="c-hour" /><col class="c-total" /><col />
    </colgroup>
    <thead>
      <tr>
        <th rowspan="2">Date</th>
        <th colspan="3">Working Hour</th>
        <th rowspan="2">Total<br/>Hour</th>
        <th rowspan="2">Activity / Remark</th>
      </tr>
      <tr><th>Start</th><th>-</th><th>End</th></tr>
    </thead>
    <tbody>
      ${dayRows}
      <tr class="total-row">
        <td class="lbl" colspan="4">Total Hours</td>
        <td>${s.totalHoursLabel}</td>
        <td></td>
      </tr>
    </tbody>
  </table>

  <div class="bottom">
    <div class="left">
      <div class="brow head"><span>Hari Kerja :</span><span></span></div>
      <div class="brow"><span>a. Jumlah hari kerja satu bulan</span><span>${s.workDays}</span></div>
      <div class="brow"><span>a. Jumlah hari pegawai Ijin</span><span>${s.permitDays}</span></div>
      <div class="brow"><span>b. Jumlah hari pegawai Sakit</span><span>${s.sickDays}</span></div>
      <div class="brow"><span>c. Jumlah hari pegawai Cuti</span><span>${s.leaveDays}</span></div>
      <div class="brow"><span>e. Jumlah kehadiran pegawai dalam sebulan</span><span>${s.attendedDays}</span></div>
      <div class="brow"><span>f. Persentase Kehadiran Karyawan</span><span>${pct(s.attendancePct)}</span></div>
      <div class="brow head"><span>Jam Kerja</span><span></span></div>
      <div class="brow"><span>g. Total Jam Kerja Standar Hari Kerja Kalender</span><span>${s.standardHoursLabel}</span></div>
      <div class="brow"><span>h. Total Kehadiran Jam Kerja</span><span>${s.totalHoursLabel}</span></div>
      <div class="brow"><span>j. Total Jam Kerja</span><span>${s.totalHoursLabel}</span></div>
      <div class="brow"><span>k. Persentase Jam Kehadiran (k/g)</span><span>${pct(s.hoursAttendancePct)}</span></div>
    </div>
    <div class="right">
      <div class="pad">
        <strong>Pernyataan Pegawai</strong>
        <p class="stmt">${esc(ts.statement)}</p>
        <strong>Penilaian User</strong>
        <div>Performance Karyawan Bulan Ini :</div>
        <div class="rate-cols">
          <div class="rate-col">
            <h4>Sasaran dan Hasil Kerja</h4>
            ${RATING_OPTIONS.map((l) => ratingRow(l)).join("")}
          </div>
          <div class="rate-col">
            <h4>Kompetensi Pendukung</h4>
            ${RATING_OPTIONS.map((l) => ratingRow(l)).join("")}
          </div>
          <div class="rate-col">
            <h4>Kedisiplinan</h4>
            ${RATING_OPTIONS.map((l) => ratingRow(l)).join("")}
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="sign">
    <div>
      <div class="sig-head">Tanda Tangan Pegawai,</div>
      ${
        p.signatureDataUrl
          ? `<img class="sig-img" src="${p.signatureDataUrl}" alt="ttd pegawai" />`
          : `<div class="spacer"></div>`
      }
      <div class="who">${esc(p.name)}</div>
    </div>
    <div>
      <div class="sig-head">Tanda Tangan DH,</div>
      <div class="spacer"></div>
      <div class="who">${esc(p.dhName)}</div>
    </div>
    <div>
      <div class="sig-head">Disetujui oleh: ${esc(p.teamLeadTitle)}</div>
      <div class="spacer"></div>
      <div class="who">${esc(p.teamLeadName)}</div>
    </div>
  </div>
</div>
</body>
</html>`;
}
