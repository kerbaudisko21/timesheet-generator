import {
  DayEntry,
  DayStatus,
  DEFAULT_STATEMENT,
  Profile,
  Timesheet,
} from "./types";

const WIB_DAY_NAMES = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** "YYYY-MM" untuk bulan sekarang */
export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const names = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  return `${names[m - 1]} ${y}`;
}

/** "Jul-26" gaya template */
export function shortPeriode(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const names = [
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
  ];
  return `${names[m - 1]}-${pad2(y % 100)}`;
}

export function dayName(dateIso: string): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  return WIB_DAY_NAMES[new Date(y, m - 1, d).getDay()];
}

export function isWeekend(dateIso: string): boolean {
  const [y, m, d] = dateIso.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return dow === 0 || dow === 6;
}

/** menit dari "HH:mm" */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function fromMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

/**
 * Durasi kerja dalam menit.
 * Bila jam pulang <= jam masuk, dianggap shift lewat tengah malam
 * (pulang keesokan harinya), jadi ditambah 24 jam.
 * Contoh: 10:00 -> 02:00 = 16 jam.
 */
export function workedMinutes(day: DayEntry): number {
  if (day.status !== "work") return 0;
  if (!day.start || !day.end) return 0;
  const start = toMinutes(day.start);
  let end = toMinutes(day.end);
  if (end < start) end += 24 * 60; // lewat tengah malam (pulang besok)
  const diff = end - start;
  return diff > 0 ? diff : 0;
}

/** "115:30" — total jam format [h]:mm */
export function formatTotalHours(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${pad2(m)}`;
}

export interface TimesheetSummary {
  totalMinutes: number;
  totalHoursLabel: string;
  workDays: number; // hari kerja kalender (Senin-Jumat, non-weekend)
  permitDays: number;
  sickDays: number;
  leaveDays: number;
  attendedDays: number; // workDays - (permit + sick + leave)
  attendancePct: number; // attendedDays / workDays
  standardMinutes: number; // workDays * 8 jam
  standardHoursLabel: string;
  hoursAttendancePct: number; // totalMinutes / standardMinutes
}

export function summarize(ts: Timesheet): TimesheetSummary {
  const totalMinutes = ts.days.reduce((s, d) => s + workedMinutes(d), 0);
  // "Jumlah hari kerja satu bulan" = hari yg memang dijadwalkan kerja:
  // status work / leave / permit / sick. Weekend, libur, dan "belum masuk"
  // (mis. sebelum join / sudah resign) tidak dihitung — sesuai contoh PDF.
  const scheduled: DayStatus[] = ["work", "leave", "permit", "sick"];
  const workDays = ts.days.filter((d) => scheduled.includes(d.status)).length;
  const permitDays = ts.days.filter((d) => d.status === "permit").length;
  const sickDays = ts.days.filter((d) => d.status === "sick").length;
  const leaveDays = ts.days.filter((d) => d.status === "leave").length;
  const attendedDays = workDays - (permitDays + sickDays + leaveDays);
  const standardMinutes = workDays * 8 * 60;
  return {
    totalMinutes,
    totalHoursLabel: formatTotalHours(totalMinutes),
    workDays,
    permitDays,
    sickDays,
    leaveDays,
    attendedDays,
    attendancePct: workDays ? attendedDays / workDays : 0,
    standardMinutes,
    standardHoursLabel: formatTotalHours(standardMinutes),
    hoursAttendancePct: standardMinutes ? totalMinutes / standardMinutes : 0,
  };
}

export function autoActivityFor(status: DayStatus, dateIso: string): string {
  switch (status) {
    case "weekend":
      return dayName(dateIso).toUpperCase() === "SABTU" ? "Sabtu" : "Minggu";
    case "holiday":
      return "Libur Nasional";
    case "leave":
      return "Cuti";
    case "permit":
      return "Izin";
    case "sick":
      return "Izin Sakit";
    case "absent":
      return "Belum Masuk";
    default:
      return "";
  }
}

/**
 * Pecah teks aktivitas menjadi baris-baris yang sudah dirapikan.
 * - Baris kosong dibuang.
 * - Jika >= 2 baris DAN belum ada penomoran/bullet manual, tambahkan "1. ", "2. ", ...
 * - Jika hanya 1 baris, kembalikan apa adanya (tanpa nomor).
 */
export function activityLines(raw: string): string[] {
  const lines = (raw || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length <= 1) return lines;

  // sudah dinomori / bullet manual? (mis. "1.", "1)", "-", "•", "*")
  const alreadyMarked = lines.every((l) =>
    /^(\d+[.)]\s+|[-•*]\s+)/.test(l)
  );
  if (alreadyMarked) return lines;

  return lines.map((l, i) => `${i + 1}. ${l}`);
}

/** buat daftar hari default untuk sebuah bulan */
export function buildDays(month: string, profile: Profile): DayEntry[] {
  const total = daysInMonth(month);
  const out: DayEntry[] = [];
  for (let d = 1; d <= total; d++) {
    const date = `${month}-${pad2(d)}`;
    const weekend = isWeekend(date);
    const status: DayStatus = weekend ? "weekend" : "work";
    out.push({
      date,
      status,
      start: weekend ? "" : profile.defaultStart || "09:00",
      end: weekend ? "" : profile.defaultEnd || "18:00",
      activity: weekend ? autoActivityFor("weekend", date) : "",
    });
  }
  return out;
}

/** gabungkan hari lama dgn struktur bulan baru, pertahankan input yg sudah ada */
export function reconcileDays(
  month: string,
  existing: DayEntry[],
  profile: Profile
): DayEntry[] {
  const fresh = buildDays(month, profile);
  const byDate = new Map(existing.map((d) => [d.date, d]));
  return fresh.map((f) => byDate.get(f.date) ?? f);
}

export const emptyProfile: Profile = {
  name: "",
  employeeId: "",
  position: "",
  placement: "PT Bank Mandiri",
  location: "Mandiri Digital Tower",
  mainProjectName: "",
  projectCode: "",
  activityCode: "",
  pmContact: "",
  teamLeadName: "",
  teamLeadTitle: "Team Lead",
  dhName: "",
  signatureDataUrl: "",
  defaultStart: "09:00",
  defaultEnd: "18:00",
};

export function emptyTimesheet(month: string): Timesheet {
  return {
    month,
    profile: emptyProfile,
    days: buildDays(month, emptyProfile),
    statement: DEFAULT_STATEMENT,
  };
}
