export type DayStatus =
  | "work" // hari kerja normal, ada jam kerja
  | "weekend" // Sabtu / Minggu
  | "holiday" // libur nasional / cuti bersama
  | "leave" // cuti
  | "permit" // izin
  | "sick" // sakit
  | "absent"; // belum masuk / tidak hadir

export interface DayEntry {
  /** ISO date string, e.g. "2026-07-01" */
  date: string;
  status: DayStatus;
  /** "HH:mm", hanya dipakai saat status = "work" */
  start: string;
  /** "HH:mm" */
  end: string;
  /** Deskripsi aktivitas / remark. Untuk weekend/holiday otomatis diisi label. */
  activity: string;
}

export interface Profile {
  name: string;
  employeeId: string;
  position: string;
  placement: string;
  location: string;
  mainProjectName: string;
  projectCode: string;
  activityCode: string;
  pmContact: string;
  /** Nama & jabatan approver */
  approverName: string;
  approverTitle: string;
  /** data URL gambar tanda tangan pegawai (png), opsional */
  signatureDataUrl: string;
  /** Default jam kerja untuk tombol "isi semua" */
  defaultStart: string;
  defaultEnd: string;
}

export interface PerformanceRating {
  /** Sasaran dan Hasil Kerja */
  sasaran: RatingLevel;
  /** Kompetensi Pendukung */
  kompetensi: RatingLevel;
  /** Kedisiplinan */
  kedisiplinan: RatingLevel;
}

export type RatingLevel =
  | "Sangat Memuaskan"
  | "Memuaskan"
  | "Tidak Memuaskan"
  | "Sangat tidak memuaskan"
  | "";

export interface Timesheet {
  /** "YYYY-MM" */
  month: string;
  profile: Profile;
  days: DayEntry[];
  rating: PerformanceRating;
  statement: string;
}

export const DEFAULT_STATEMENT =
  "Time report ini saya buat dengan sunguh-sungguh dan sebenarnya sesuai dengan nilai-nilai etika dan profesionalisme perusahaan.";

export const RATING_LEVELS: RatingLevel[] = [
  "Sangat Memuaskan",
  "Memuaskan",
  "Tidak Memuaskan",
  "Sangat tidak memuaskan",
];

export const STATUS_LABELS: Record<DayStatus, string> = {
  work: "Hari Kerja",
  weekend: "Weekend",
  holiday: "Libur / Cuti Bersama",
  leave: "Cuti",
  permit: "Izin",
  sick: "Sakit",
  absent: "Belum Masuk",
};
