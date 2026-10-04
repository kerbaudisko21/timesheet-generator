"use client";

import { useState } from "react";
import { usePersistentState } from "@/lib/storage";
import { autoActivityFor } from "@/lib/timesheet";
import { DayEntry, DayStatus, OfficeHours } from "@/lib/types";

/** Satu hari dari Michely (GET /work/timesheet). */
type MichelyDay = {
  date: string;
  status: "work" | "leave" | "permit" | "sick" | "holiday";
  remark: string;
};

type Conn = { url: string; secret: string };

type Props = {
  month: string;
  days: DayEntry[];
  office: OfficeHours;
  onChange: (days: DayEntry[]) => void;
  onToast: (msg: string, err?: boolean) => void;
};

/**
 * Isi remark harian (nomor tiket & aktivitas) dan status cuti/izin/sakit dari
 * catatan kerja di Michely. Hari yang tidak ada catatannya di Michely tidak diubah.
 */
export function MichelyImport({ month, days, office, onChange, onToast }: Props) {
  const [conn, setConn] = usePersistentState<Conn>("tsg.michely", { url: "", secret: "" });
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const connected = Boolean(conn.url && conn.secret);

  async function pull() {
    setBusy(true);
    try {
      const base = conn.url.trim().replace(/\/+$/, "");
      const res = await fetch(`${base}/work/timesheet?month=${month}`, {
        headers: { Authorization: `Bearer ${conn.secret.trim()}` },
      });
      if (res.status === 401) throw new Error("password Michely salah");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { days: MichelyDay[] };
      const byDate = new Map(data.days.map((d) => [d.date, d]));

      let changed = 0;
      const next = days.map((d) => {
        const m = byDate.get(d.date);
        if (!m || (m.status === "work" && !m.remark)) return d;
        changed++;
        if (m.status === "work") {
          return {
            ...d,
            status: "work" as DayStatus,
            start: d.status === "work" && d.start ? d.start : office.start,
            end: d.status === "work" && d.end ? d.end : office.end,
            activity: m.remark,
          };
        }
        return { ...d, status: m.status as DayStatus, start: "", end: "", activity: autoActivityFor(m.status, d.date) };
      });

      onChange(next);
      onToast(changed ? `${changed} hari diisi dari Michely.` : "Belum ada catatan kerja bulan ini di Michely.");
    } catch (e) {
      onToast(`Gagal mengambil dari Michely: ${e instanceof Error ? e.message : "error"}`, true);
    } finally {
      setBusy(false);
    }
  }

  if (!connected || editing) {
    return (
      <div className="michely-box">
        <p className="inline-help" style={{ marginTop: 0 }}>
          Hubungkan ke Michely supaya remark harian (nomor tiket &amp; aktivitas) dan cuti/izin/sakit bisa diisi otomatis.
          Disimpan hanya di browser ini.
        </p>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="michely-url">URL server Michely</label>
            <input
              id="michely-url"
              type="url"
              placeholder="https://michely-be.vercel.app"
              value={conn.url}
              onChange={(e) => setConn((c) => ({ ...c, url: e.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="michely-secret">Password (MICHELY_SECRET)</label>
            <input
              id="michely-secret"
              type="password"
              value={conn.secret}
              onChange={(e) => setConn((c) => ({ ...c, secret: e.target.value }))}
            />
          </div>
        </div>
        {connected && (
          <button type="button" className="btn" onClick={() => setEditing(false)}>
            Selesai
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="days-toolbar">
      <button type="button" className="btn primary" disabled={busy} onClick={pull}>
        {busy ? "Mengambil…" : "⬇ Ambil dari Michely"}
      </button>
      <span className="inline-help" style={{ margin: 0 }}>
        Menimpa remark hari yang ada catatannya di Michely.
      </span>
      <span className="spacer" />
      <button type="button" className="link-btn" onClick={() => setEditing(true)}>
        Ubah koneksi
      </button>
    </div>
  );
}
