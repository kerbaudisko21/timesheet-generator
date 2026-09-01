import ExcelJS from "exceljs";
import path from "path";
import { promises as fs } from "fs";
import {
  autoActivityFor,
  isWeekend,
  summarize,
  toMinutes,
  workedMinutes,
} from "./timesheet";
import { DayEntry, Timesheet } from "./types";

/**
 * Baris tanggal pada template: row 17 .. 47 (31 baris).
 * Kolom: A = Date, C = Start, E = End, F = Total Hour, G = Activity (merge G:O).
 */
const FIRST_DAY_ROW = 17;
const MAX_DAY_ROWS = 31;

const PINK = "FFD99694"; // accent2 (C0504D) + tint 40% — sama dgn baris weekend di PDF contoh
const WHITE = "FFFFFFFF";

let cachedTemplate: Buffer | null = null;

async function loadTemplate(): Promise<Buffer> {
  if (cachedTemplate) return cachedTemplate;
  // src/assets/template.xlsx di-bundle lewat file tracing Next (lihat route.ts)
  const p = path.join(process.cwd(), "src", "assets", "template.xlsx");
  cachedTemplate = await fs.readFile(p);
  return cachedTemplate;
}

function setFill(cell: ExcelJS.Cell, argb: string) {
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb },
  };
}

function hoursToExcelTime(hhmm: string): number | null {
  if (!hhmm) return null;
  const mins = toMinutes(hhmm);
  return mins / (24 * 60); // fraksi hari
}

function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; ext: "png" | "jpeg" } | null {
  const m = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(dataUrl.trim());
  if (!m) return null;
  const ext = m[1].toLowerCase().startsWith("jp") ? "jpeg" : "png";
  return { buffer: Buffer.from(m[2], "base64"), ext };
}

export async function fillTimesheetXlsx(ts: Timesheet): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await loadTemplate()) as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  const s = summarize(ts);
  const p = ts.profile;

  // --- Header info ---
  ws.getCell("D3").value = p.name;
  ws.getCell("D4").value = p.employeeId;
  ws.getCell("D5").value = p.position;
  ws.getCell("D6").value = p.placement;
  ws.getCell("D7").value = p.location;
  ws.getCell("D8").value = p.mainProjectName;
  ws.getCell("D9").value = p.projectCode;
  ws.getCell("D10").value = p.activityCode;
  ws.getCell("D11").value = p.pmContact;
  const [py, pm] = ts.month.split("-").map(Number);
  // ExcelJS menyerialisasi Date sebagai UTC -> pakai Date.UTC agar tidak geser 1 hari
  ws.getCell("D12").value = new Date(Date.UTC(py, pm - 1, 1));
  ws.getCell("D12").numFmt = "mmm-yy";

  // --- Baris tanggal ---
  const days = ts.days.slice(0, MAX_DAY_ROWS);
  for (let i = 0; i < MAX_DAY_ROWS; i++) {
    const rowNum = FIRST_DAY_ROW + i;
    const aCell = ws.getCell(`A${rowNum}`);
    const cCell = ws.getCell(`C${rowNum}`);
    const eCell = ws.getCell(`E${rowNum}`);
    const fCell = ws.getCell(`F${rowNum}`);
    const gCell = ws.getCell(`G${rowNum}`);

    const day: DayEntry | undefined = days[i];
    if (!day) {
      // bulan < 31 hari: kosongkan sisa baris
      aCell.value = null;
      cCell.value = null;
      eCell.value = null;
      fCell.value = null;
      gCell.value = null;
      [aCell, cCell, eCell, fCell, gCell].forEach((c) => setFill(c, WHITE));
      continue;
    }

    const [dy, dm, dd] = day.date.split("-").map(Number);
    aCell.value = new Date(Date.UTC(dy, dm - 1, dd));
    aCell.numFmt = "dd-mmm-yyyy";

    const isWork = day.status === "work" && workedMinutes(day) > 0;
    if (isWork) {
      const st = hoursToExcelTime(day.start);
      const en = hoursToExcelTime(day.end);
      cCell.value = st;
      eCell.value = en;
      cCell.numFmt = "h:mm";
      eCell.numFmt = "h:mm";
      fCell.value = { formula: `E${rowNum}-C${rowNum}`, date1904: false } as ExcelJS.CellFormulaValue;
      fCell.numFmt = "h:mm";
      gCell.value =
        day.activity && day.activity.trim()
          ? day.activity.trim()
          : "";
      [aCell, cCell, eCell, fCell, gCell].forEach((c) => setFill(c, WHITE));
    } else {
      cCell.value = null;
      eCell.value = null;
      fCell.value = null;
      gCell.value =
        day.activity && day.activity.trim()
          ? day.activity.trim()
          : autoActivityFor(day.status, day.date);
      [aCell, cCell, eCell, fCell, gCell].forEach((c) => setFill(c, PINK));
    }
  }

  // --- Total & rekap (biarkan formula template, tapi update input F50-F53) ---
  ws.getCell("F48").value = {
    formula: `SUM(F${FIRST_DAY_ROW}:F${FIRST_DAY_ROW + MAX_DAY_ROWS - 1})`,
  } as ExcelJS.CellFormulaValue;
  ws.getCell("F48").numFmt = "[h]:mm";

  ws.getCell("F50").value = s.workDays; // Jumlah hari kerja satu bulan
  ws.getCell("F51").value = s.permitDays; // Ijin
  ws.getCell("F52").value = s.sickDays; // Sakit
  ws.getCell("F53").value = s.leaveDays; // Cuti
  // F54 = F50-(F51+F52+F53), F55 = F54/F50 — formula template dipertahankan
  ws.getCell("F54").value = { formula: "F50-(F51+F52+F53)" } as ExcelJS.CellFormulaValue;
  ws.getCell("F55").value = { formula: "F54/F50" } as ExcelJS.CellFormulaValue;
  ws.getCell("F55").numFmt = "0%";
  ws.getCell("F57").value = { formula: "F50*8/24" } as ExcelJS.CellFormulaValue;
  ws.getCell("F57").numFmt = "[h]:mm";
  ws.getCell("F58").value = { formula: "F48" } as ExcelJS.CellFormulaValue;
  ws.getCell("F58").numFmt = "[h]:mm";
  ws.getCell("F59").value = { formula: "F58" } as ExcelJS.CellFormulaValue;
  ws.getCell("F59").numFmt = "[h]:mm";
  ws.getCell("F60").value = { formula: "F59/F57" } as ExcelJS.CellFormulaValue;
  ws.getCell("F60").numFmt = "0%";

  // --- Pernyataan & penilaian ---
  ws.getCell("G49").value = ts.statement;
  ws.getCell("G50").value = "";

  // tandai rating dgn menaruh "V" di kolom pengecek (H/K/N) sesuai baris 57-60
  const ratingRowByLevel: Record<string, number> = {
    "Sangat Memuaskan": 57,
    Memuaskan: 58,
    "Tidak Memuaskan": 59,
    "Sangat tidak memuaskan": 60,
  };
  ["H", "K", "N"].forEach((col) => {
    for (let r = 57; r <= 60; r++) ws.getCell(`${col}${r}`).value = null;
  });
  const marks: [string, string][] = [
    ["H", ts.rating.sasaran],
    ["K", ts.rating.kompetensi],
    ["N", ts.rating.kedisiplinan],
  ];
  for (const [col, level] of marks) {
    const r = ratingRowByLevel[level];
    if (r) {
      const cell = ws.getCell(`${col}${r}`);
      cell.value = "V";
      cell.alignment = { horizontal: "center", vertical: "middle" };
    }
  }

  // --- Nama & approver di blok tanda tangan ---
  ws.getCell("C66").value = p.name;
  ws.getCell("J61").value = `Disetujui oleh: ${p.approverTitle}`;
  ws.getCell("J66").value = p.approverName;

  // --- Tanda tangan gambar ---
  if (p.signatureDataUrl) {
    const sig = dataUrlToBuffer(p.signatureDataUrl);
    if (sig) {
      const imageId = wb.addImage({ buffer: sig.buffer as unknown as ExcelJS.Buffer, extension: sig.ext });
      // area C62:F65 (di atas nama pegawai)
      ws.addImage(imageId, {
        tl: { col: 2.2, row: 61.2 },
        ext: { width: 150, height: 55 },
        editAs: "oneCell",
      });
    }
  }

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
