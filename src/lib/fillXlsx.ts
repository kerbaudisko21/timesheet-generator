import ExcelJS from "exceljs";
import {
  activityLines,
  autoActivityFor,
  shortPeriode,
  summarize,
  toMinutes,
  workedMinutes,
} from "./timesheet";
import { DayEntry, PENILAIAN_OPTIONS, Timesheet } from "./types";
import { MANDIRI_LOGO_DATA_URL } from "@/assets/logo";

/**
 * Membangun workbook timesheet dari nol, meniru layout PDF Mandiri MCO
 * (bukan mengisi template lama). Semua angka rekap tetap memakai FORMULA
 * agar file bisa dihitung ulang bila dibuka di Excel.
 *
 * Peta kolom:
 *   A = Date | B = Start | C = "-" | D = End | E = Total Hour | F..M = Activity
 */

const PINK = "FFD99694";
const HEAD_FILL = "FFF2F2F2";
const THIN: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "FF000000" } };
const BOX: Partial<ExcelJS.Borders> = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const FONT = "Tahoma";

function timeFraction(hhmm: string): number | null {
  if (!hhmm) return null;
  return toMinutes(hhmm) / (24 * 60);
}

function dataUrlToBuffer(
  dataUrl: string
): { buffer: Buffer; ext: "png" | "jpeg" } | null {
  const m = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(dataUrl.trim());
  if (!m) return null;
  const ext = m[1].toLowerCase().startsWith("jp") ? "jpeg" : "png";
  return { buffer: Buffer.from(m[2], "base64"), ext };
}

export async function fillTimesheetXlsx(ts: Timesheet): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Timesheet Generator";
  wb.created = new Date();

  const ws = wb.addWorksheet("Timesheet", {
    pageSetup: {
      paperSize: 9, // A4
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.24,
        right: 0.2,
        top: 0.39,
        bottom: 0.67,
        header: 0.3,
        footer: 0.3,
      },
    },
    views: [{ showGridLines: false }],
  });

  ws.properties.defaultRowHeight = 15;
  const widths = [11.5, 8, 3, 8, 9, 16, 4, 2, 20, 4, 1.6, 20, 4, 2];
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));

  const p = ts.profile;
  const s = summarize(ts);

  const base = (cell: ExcelJS.Cell) => {
    cell.font = { name: FONT, size: 9 };
  };

  // ================= HEADER INFO (A1:E10) + LOGO =================
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
  infoRows.forEach(([k, v], i) => {
    const r = i + 1;
    const kc = ws.getCell(r, 1);
    const cc = ws.getCell(r, 2);
    const vc = ws.getCell(r, 3);
    kc.value = k;
    cc.value = ":";
    vc.value = v;
    [kc, cc, vc].forEach(base);
    cc.alignment = { horizontal: "center" };
    ws.mergeCells(r, 3, r, 5);
  });
  // kotak di sekeliling blok info
  for (let r = 1; r <= 10; r++) {
    for (let c = 1; c <= 5; c++) {
      const cell = ws.getCell(r, c);
      cell.border = {
        top: r === 1 ? THIN : undefined,
        bottom: r === 10 ? THIN : undefined,
        left: c === 1 ? THIN : undefined,
        right: c === 5 ? THIN : undefined,
      };
    }
  }

  const logo = dataUrlToBuffer(MANDIRI_LOGO_DATA_URL);
  if (logo) {
    const id = wb.addImage({
      buffer: logo.buffer as unknown as ExcelJS.Buffer,
      extension: logo.ext,
    });
    ws.addImage(id, { tl: { col: 10, row: 0.2 }, ext: { width: 150, height: 60 } });
  }

  // ================= GRID HEADER (row 12-13) =================
  const HR1 = 12;
  const HR2 = 13;
  ws.mergeCells(HR1, 1, HR2, 1); // Date
  ws.mergeCells(HR1, 2, HR1, 4); // Working Hour
  ws.mergeCells(HR1, 5, HR2, 5); // Total Hour
  ws.mergeCells(HR1, 6, HR2, 14); // Activity / Remark
  ws.getCell(HR1, 1).value = "Date";
  ws.getCell(HR1, 2).value = "Working Hour";
  ws.getCell(HR1, 5).value = "Total\nHour";
  ws.getCell(HR1, 6).value = "Activity / Remark";
  ws.getCell(HR2, 2).value = "Start";
  ws.getCell(HR2, 3).value = "-";
  ws.getCell(HR2, 4).value = "End";
  for (let r = HR1; r <= HR2; r++) {
    for (let c = 1; c <= 14; c++) {
      const cell = ws.getCell(r, c);
      cell.font = { name: FONT, size: 8, bold: true };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = BOX;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEAD_FILL } };
    }
  }
  ws.getRow(HR1).height = 13;
  ws.getRow(HR2).height = 13;

  // ================= DAY ROWS =================
  const FIRST = HR2 + 1; // 14
  const days = ts.days;
  days.forEach((day: DayEntry, i) => {
    const r = FIRST + i;
    const row = ws.getRow(r);

    const [dy, dm, dd] = day.date.split("-").map(Number);
    const dateCell = ws.getCell(r, 1);
    dateCell.value = new Date(Date.UTC(dy, dm - 1, dd));
    dateCell.numFmt = "dd-mmm-yyyy";
    dateCell.font = { name: FONT, size: 8 };
    dateCell.alignment = { horizontal: "center", vertical: "middle" };

    const isWork = day.status === "work" && workedMinutes(day) > 0;
    const bCell = ws.getCell(r, 2);
    const cCell = ws.getCell(r, 3);
    const dCell = ws.getCell(r, 4);
    const eCell = ws.getCell(r, 5);

    if (isWork) {
      bCell.value = timeFraction(day.start);
      dCell.value = timeFraction(day.end);
      cCell.value = "-";
      bCell.numFmt = "h:mm";
      dCell.numFmt = "h:mm";
      eCell.value = { formula: `D${r}-B${r}` } as ExcelJS.CellFormulaValue;
      eCell.numFmt = "h:mm";
    } else {
      bCell.value = null;
      cCell.value = null;
      dCell.value = null;
      eCell.value = null;
    }

    ws.mergeCells(r, 6, r, 14);
    const actCell = ws.getCell(r, 6);
    let actText: string;
    let lineCount = 1;
    if (day.activity && day.activity.trim()) {
      const lines = activityLines(day.activity);
      lineCount = Math.max(1, lines.length);
      actText = lines.join("\n");
    } else if (isWork) {
      actText = "";
    } else {
      actText = autoActivityFor(day.status, day.date);
    }
    actCell.value = actText;
    actCell.alignment = {
      horizontal: lineCount > 1 ? "left" : "center",
      vertical: "middle",
      wrapText: true,
    };
    // tinggi baris menyesuaikan jumlah baris aktivitas (≈12pt per baris)
    row.height = lineCount > 1 ? 12 * lineCount + 3 : 13.5;

    for (let c = 1; c <= 14; c++) {
      const cell = ws.getCell(r, c);
      cell.font = cell.font ?? { name: FONT, size: 8 };
      cell.border = BOX;
      if (!isWork) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PINK } };
      }
    }
  });

  const LAST = FIRST + days.length - 1;

  // ================= TOTAL HOURS ROW =================
  const totalRow = LAST + 1;
  ws.mergeCells(totalRow, 1, totalRow, 4);
  ws.getCell(totalRow, 1).value = "Total Hours";
  ws.getCell(totalRow, 1).font = { name: FONT, size: 9, bold: true };
  ws.getCell(totalRow, 1).alignment = { horizontal: "center", vertical: "middle" };
  const totCell = ws.getCell(totalRow, 5);
  totCell.value = { formula: `SUM(E${FIRST}:E${LAST})` } as ExcelJS.CellFormulaValue;
  totCell.numFmt = "[h]:mm";
  totCell.font = { name: FONT, size: 9, bold: true };
  totCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.mergeCells(totalRow, 6, totalRow, 14);
  ws.getCell(totalRow, 6).value = "Pernyataan Pegawai";
  ws.getCell(totalRow, 6).font = { name: FONT, size: 9, bold: true };
  for (let c = 1; c <= 14; c++) ws.getCell(totalRow, c).border = BOX;

  // ================= REKAP KIRI (kolom A..E) =================
  let r = totalRow + 1;
  const leftLabel = (
    row: number,
    text: string,
    opts: { bold?: boolean } = {}
  ) => {
    ws.mergeCells(row, 1, row, 4);
    const cell = ws.getCell(row, 1);
    cell.value = text;
    cell.font = { name: FONT, size: 9, bold: !!opts.bold };
    cell.alignment = { vertical: "middle" };
    for (let c = 1; c <= 5; c++) ws.getCell(row, c).border = BOX;
  };
  const leftValue = (
    row: number,
    value: ExcelJS.CellValue,
    numFmt?: string
  ) => {
    const cell = ws.getCell(row, 5);
    cell.value = value;
    if (numFmt) cell.numFmt = numFmt;
    cell.font = { name: FONT, size: 9 };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  };

  const rowHariKerja = r;
  leftLabel(r, "Hari Kerja :", { bold: true });
  r++;
  const rWorkDays = r;
  leftLabel(r, "a.  Jumlah hari kerja satu bulan");
  leftValue(r, s.workDays);
  r++;
  const rIjin = r;
  leftLabel(r, "a.  Jumlah hari pegawai Ijin");
  leftValue(r, s.permitDays);
  r++;
  const rSakit = r;
  leftLabel(r, "b.  Jumlah hari pegawai Sakit");
  leftValue(r, s.sickDays);
  r++;
  const rCuti = r;
  leftLabel(r, "c.  Jumlah hari pegawai Cuti");
  leftValue(r, s.leaveDays);
  r++;
  const rHadir = r;
  leftLabel(r, "e.  Jumlah kehadiran pegawai dalam sebulan");
  leftValue(r, {
    formula: `E${rWorkDays}-(E${rIjin}+E${rSakit}+E${rCuti})`,
  } as ExcelJS.CellFormulaValue);
  r++;
  const rPctHadir = r;
  leftLabel(r, "f.   Persentase Kehadiran Karyawan");
  leftValue(
    r,
    { formula: `IF(E${rWorkDays}=0,0,E${rHadir}/E${rWorkDays})` } as ExcelJS.CellFormulaValue,
    "0%"
  );
  r++;
  const rJamKerja = r;
  leftLabel(r, "Jam Kerja", { bold: true });
  r++;
  const rStd = r;
  leftLabel(r, "g.  Total Jam Kerja Standar Hari Kerja Kalender");
  leftValue(
    r,
    { formula: `E${rWorkDays}*8/24` } as ExcelJS.CellFormulaValue,
    "[h]:mm"
  );
  r++;
  const rHadirJam = r;
  leftLabel(r, "h.  Total Kehadiran Jam Kerja");
  leftValue(r, { formula: `E${totalRow}` } as ExcelJS.CellFormulaValue, "[h]:mm");
  r++;
  const rTotalJam = r;
  leftLabel(r, "j.  Total Jam Kerja");
  leftValue(r, { formula: `E${rHadirJam}` } as ExcelJS.CellFormulaValue, "[h]:mm");
  r++;
  const rPctJam = r;
  leftLabel(r, "k. Persentase Jam Kehadiran (k/g)");
  leftValue(
    r,
    { formula: `IF(E${rStd}=0,0,E${rTotalJam}/E${rStd})` } as ExcelJS.CellFormulaValue,
    "0%"
  );
  const lastLeftRow = r;

  // ================= PANEL KANAN (kolom F..N) =================
  // Pernyataan sudah di totalRow. Isi teks pernyataan + penilaian.
  ws.mergeCells(rowHariKerja, 6, rowHariKerja + 2, 14);
  const stmtCell = ws.getCell(rowHariKerja, 6);
  stmtCell.value = ts.statement;
  stmtCell.font = { name: FONT, size: 8, italic: true };
  stmtCell.alignment = { vertical: "top", wrapText: true };

  const rPenilaian = rowHariKerja + 3;
  ws.mergeCells(rPenilaian, 6, rPenilaian, 14);
  ws.getCell(rPenilaian, 6).value = "Penilaian User";
  ws.getCell(rPenilaian, 6).font = { name: FONT, size: 9, bold: true };

  const rPerf = rPenilaian + 1;
  ws.mergeCells(rPerf, 6, rPerf, 14);
  ws.getCell(rPerf, 6).value = "Performance Karyawan Bulan Ini :";
  ws.getCell(rPerf, 6).font = { name: FONT, size: 8 };

  // 3 kolom rating: F-H (Sasaran), I-K (Kompetensi), L-N (Kedisiplinan)
  // Kotak sengaja DIBIARKAN KOSONG — diisi manual oleh Team Lead.
  const rRateHead = rPerf + 1;
  const cats: [string, number][] = [
    ["Sasaran dan Hasil Kerja", 6],
    ["Kompetensi Pendukung", 9],
    ["Kedisiplinan", 12],
  ];
  for (const [title, startCol] of cats) {
    ws.mergeCells(rRateHead, startCol, rRateHead, startCol + 2);
    const h = ws.getCell(rRateHead, startCol);
    h.value = title;
    h.font = { name: FONT, size: 8, bold: true };
    h.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEAD_FILL } };
    h.alignment = { horizontal: "left", vertical: "middle" };
    for (let c = startCol; c < startCol + 3; c++)
      ws.getCell(rRateHead, c).border = BOX;
  }
  PENILAIAN_OPTIONS.forEach((level, li) => {
    const rr = rRateHead + 1 + li;
    for (const [, startCol] of cats) {
      ws.mergeCells(rr, startCol, rr, startCol + 1);
      const lbl = ws.getCell(rr, startCol);
      lbl.value = level;
      lbl.font = { name: FONT, size: 8 };
      lbl.alignment = { horizontal: "left", vertical: "middle" };
      const box = ws.getCell(rr, startCol + 2);
      box.value = ""; // dibiarkan kosong — diisi manual oleh Team Lead
      box.border = BOX;
      for (let c = startCol; c < startCol + 3; c++)
        ws.getCell(rr, c).border = BOX;
    }
  });
  const lastRightRow = rRateHead + PENILAIAN_OPTIONS.length;

  // border kotak besar utk seluruh panel kanan
  const panelBottom = Math.max(lastLeftRow, lastRightRow);
  for (let rr = totalRow; rr <= panelBottom; rr++) {
    ws.getCell(rr, 6).border = { ...ws.getCell(rr, 6).border, left: THIN };
    ws.getCell(rr, 14).border = { ...ws.getCell(rr, 14).border, right: THIN };
  }

  // ================= BLOK TANDA TANGAN (3 kolom) =================
  const sigTop = panelBottom + 2;
  const sigHeadRow = sigTop;
  const sigBodyRow = sigTop + 1;
  const sigNameRow = sigTop + 5;

  ws.getRow(sigBodyRow).height = 18;
  ws.getRow(sigBodyRow + 1).height = 18;
  ws.getRow(sigBodyRow + 2).height = 18;
  ws.getRow(sigBodyRow + 3).height = 18;

  const sigCols: [string, string][] = [
    ["Tanda Tangan Pegawai,", p.name],
    ["Tanda Tangan DH,", p.dhName],
    [`Disetujui oleh: ${p.teamLeadTitle || "Team Lead"}`, p.teamLeadName],
  ];
  // kolom: A-E | F-I | J-N
  const spans: [number, number][] = [
    [1, 5],
    [6, 9],
    [10, 14],
  ];
  sigCols.forEach(([head, name], i) => {
    const [c1, c2] = spans[i];
    ws.mergeCells(sigHeadRow, c1, sigHeadRow, c2);
    const hc = ws.getCell(sigHeadRow, c1);
    hc.value = head;
    hc.font = { name: FONT, size: 9 };
    hc.alignment = { horizontal: "center" };

    ws.mergeCells(sigNameRow, c1, sigNameRow, c2);
    const nc = ws.getCell(sigNameRow, c1);
    nc.value = name;
    nc.font = { name: FONT, size: 9, bold: true };
    nc.alignment = { horizontal: "center" };

    // border kotak keseluruhan sel tanda tangan
    for (let rr = sigHeadRow; rr <= sigNameRow; rr++) {
      for (let cc = c1; cc <= c2; cc++) {
        const cell = ws.getCell(rr, cc);
        cell.border = {
          top: rr === sigHeadRow ? THIN : undefined,
          bottom: rr === sigNameRow ? THIN : undefined,
          left: cc === c1 ? THIN : undefined,
          right: cc === c2 ? THIN : undefined,
        };
      }
    }
  });

  // gambar tanda tangan pegawai
  if (p.signatureDataUrl) {
    const sig = dataUrlToBuffer(p.signatureDataUrl);
    if (sig) {
      const id = wb.addImage({
        buffer: sig.buffer as unknown as ExcelJS.Buffer,
        extension: sig.ext,
      });
      ws.addImage(id, {
        tl: { col: 1, row: sigBodyRow - 0.8 },
        ext: { width: 130, height: 48 },
        editAs: "oneCell",
      });
    }
  }

  ws.pageSetup.printArea = `A1:N${sigNameRow}`;

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
