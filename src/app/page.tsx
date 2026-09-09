"use client";

import { useEffect, useMemo, useState } from "react";
import { Collapsible } from "@/components/Collapsible";
import { ProfileForm } from "@/components/ProfileForm";
import { DayEditor } from "@/components/DayEditor";
import { Preview } from "@/components/Preview";
import { usePersistentState } from "@/lib/storage";
import {
  currentMonth,
  emptyProfile,
  monthLabel,
  overtimeEntries,
  reconcileDays,
  summarize,
} from "@/lib/timesheet";
import { DEFAULT_STATEMENT, Profile, Timesheet } from "@/lib/types";

type Toast = { msg: string; err?: boolean } | null;

export default function Page() {
  const [profile, setProfile] = usePersistentState<Profile>(
    "tsg.profile",
    emptyProfile
  );
  const [month, setMonth] = usePersistentState<string>(
    "tsg.month",
    currentMonth()
  );
  const [daysByMonth, setDaysByMonth] = usePersistentState<
    Record<string, Timesheet["days"]>
  >("tsg.daysByMonth", {});
  const [statement, setStatement] = usePersistentState<string>(
    "tsg.statement",
    DEFAULT_STATEMENT
  );

  const [toast, setToast] = useState<Toast>(null);
  const [busy, setBusy] = useState<"" | "xlsx" | "pdf" | "lembur">("");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // pastikan struktur hari untuk bulan aktif selalu sinkron dgn kalender + profil
  useEffect(() => {
    if (!mounted) return;
    setDaysByMonth((prev) => {
      const existing = prev[month] ?? [];
      const next = reconcileDays(month, existing, profile);
      return { ...prev, [month]: next };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, mounted, profile.defaultStart, profile.defaultEnd]);

  const days = daysByMonth[month] ?? [];

  const timesheet: Timesheet = useMemo(
    () => ({ month, profile, days, statement }),
    [month, profile, days, statement]
  );

  const summary = useMemo(() => summarize(timesheet), [timesheet]);
  const overtime = useMemo(() => overtimeEntries(timesheet), [timesheet]);

  function showToast(msg: string, err = false) {
    setToast({ msg, err });
    setTimeout(() => setToast(null), 3200);
  }

  function updateProfile(patch: Partial<Profile>) {
    setProfile((p) => ({ ...p, ...patch }));
  }

  function updateDays(next: Timesheet["days"]) {
    setDaysByMonth((prev) => ({ ...prev, [month]: next }));
  }

  async function download(kind: "xlsx" | "pdf" | "lembur") {
    if (!profile.name.trim()) {
      showToast("Isi dulu nama di bagian Profil.", true);
      return;
    }
    const labelMap: Record<typeof kind, string> = {
      xlsx: "XLSX",
      pdf: "PDF",
      lembur: "Surat Lembur",
    };
    setBusy(kind);
    try {
      const res = await fetch(`/api/export/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(timesheet),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const m = /filename="([^"]+)"/.exec(cd);
      const ext = kind === "xlsx" ? "xlsx" : "pdf";
      const fname =
        m?.[1] ||
        `${kind}_${profile.name}_${monthLabel(month).replace(" ", "_")}.${ext}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fname;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`${labelMap[kind]} berhasil diunduh.`);
    } catch (e) {
      showToast(
        `Gagal membuat ${labelMap[kind]}: ${
          e instanceof Error ? e.message : "error"
        }`,
        true
      );
    } finally {
      setBusy("");
    }
  }

  function resetMonth() {
    if (!confirm(`Reset semua isian bulan ${monthLabel(month)}?`)) return;
    setDaysByMonth((prev) => {
      const copy = { ...prev };
      delete copy[month];
      return copy;
    });
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <div className="mark">TS</div>
          <div>
            <h1>Timesheet Generator</h1>
            <p>Format Mandiri · export XLSX &amp; PDF · data tersimpan di browser</p>
          </div>
        </div>
        <div className="btn-row">
          <button
            className="btn primary"
            disabled={!!busy}
            onClick={() => download("xlsx")}
          >
            {busy === "xlsx" ? "Membuat…" : "⬇ Download XLSX"}
          </button>
          <button
            className="btn gold"
            disabled={!!busy}
            onClick={() => download("pdf")}
          >
            {busy === "pdf" ? "Membuat…" : "⬇ Download PDF"}
          </button>
        </div>
      </header>

      <div className="layout">
        {/* ---- kiri: form ---- */}
        <div className="card">
          <div className="card-head">
            <h2>Data Timesheet</h2>
            <span className="hint">otomatis tersimpan</span>
          </div>

          <Collapsible title="1. Profil (isi sekali)" defaultOpen={!profile.name}>
            <ProfileForm profile={profile} onChange={updateProfile} />
          </Collapsible>

          <Collapsible title="2. Periode & Ringkasan">
            <div className="grid-2">
              <div className="field">
                <label htmlFor="month">Bulan</label>
                <input
                  id="month"
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                />
              </div>
              <div
                className="field"
                style={{ justifyContent: "flex-end" }}
              >
                <button className="btn ghost" onClick={resetMonth}>
                  Reset isian bulan ini
                </button>
              </div>
            </div>

            <div className="stat-grid">
              <div className="stat">
                <div className="k">Hari kerja</div>
                <div className="v">{summary.workDays}</div>
              </div>
              <div className="stat">
                <div className="k">Total jam</div>
                <div className="v">{summary.totalHoursLabel}</div>
              </div>
              <div className="stat">
                <div className="k">Kehadiran</div>
                <div className="v">
                  {Math.round(summary.attendancePct * 100)}%
                </div>
              </div>
              <div className="stat">
                <div className="k">% Jam (k/g)</div>
                <div className="v">
                  {Math.round(summary.hoursAttendancePct * 100)}%
                </div>
              </div>
            </div>
          </Collapsible>

          <Collapsible title="3. Aktivitas Harian">
            {mounted ? (
              <DayEditor
                days={days}
                defaultStart={profile.defaultStart}
                defaultEnd={profile.defaultEnd}
                onChange={updateDays}
              />
            ) : (
              <p className="inline-help">Memuat…</p>
            )}
          </Collapsible>

          <Collapsible title="4. Pernyataan Pegawai" defaultOpen={false}>
            <div className="field">
              <label htmlFor="stmt">Pernyataan Pegawai</label>
              <textarea
                id="stmt"
                value={statement}
                onChange={(e) => setStatement(e.target.value)}
              />
              <p className="inline-help">
                Bagian &quot;Penilaian User&quot; (Sasaran / Kompetensi /
                Kedisiplinan) sengaja dibiarkan kosong di output — diisi manual
                oleh Team Lead.
              </p>
            </div>
          </Collapsible>

          <Collapsible
            title="5. Lembur"
            defaultOpen={false}
            right={
              overtime.length > 0 ? (
                <span className="badge">{overtime.length} hari</span>
              ) : undefined
            }
          >
            <p className="inline-help" style={{ marginBottom: 12 }}>
              Otomatis dari Aktivitas Harian: setiap hari kerja dengan total
              &gt; 9 jam dihitung lembur. Jam mulai lembur = jam masuk + 9 jam,
              total dibulatkan ke 0,5 jam terdekat. Unit Kerja memakai Main
              Project Name.
            </p>

            {overtime.length === 0 ? (
              <p className="empty-note">
                Tidak ada hari lembur pada {monthLabel(month)}. Isi jam pulang
                lebih dari 9 jam kerja untuk memunculkan baris lembur.
              </p>
            ) : (
              <div className="ot-list">
                <div className="ot-row ot-head">
                  <span>Hari / Tanggal</span>
                  <span>Waktu Lembur</span>
                  <span>Total (jam)</span>
                  <span>Pekerjaan</span>
                </div>
                {overtime.map((e) => (
                  <div className="ot-row" key={e.date}>
                    <span>{e.dayLabel}</span>
                    <span>{e.windowLabel}</span>
                    <span className="ot-total">
                      {Number.isInteger(e.totalHours)
                        ? e.totalHours
                        : e.totalHours.toFixed(1)}
                    </span>
                    <span className="ot-work">{e.work || "—"}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="btn-row" style={{ marginTop: 14 }}>
              <button
                className="btn primary"
                disabled={!!busy || overtime.length === 0}
                onClick={() => download("lembur")}
              >
                {busy === "lembur"
                  ? "Membuat…"
                  : "⬇ Download Surat Lembur (PDF)"}
              </button>
            </div>
          </Collapsible>
        </div>

        {/* ---- kanan: preview ---- */}
        <div className="card preview-wrap">
          <div className="card-head">
            <h2>Preview</h2>
            <span className="hint">{monthLabel(month)}</span>
          </div>
          <div className="card-body">
            {mounted ? (
              <Preview timesheet={timesheet} />
            ) : (
              <p className="inline-help">Memuat preview…</p>
            )}
          </div>
        </div>
      </div>

      <p className="footer-note">
        Semua data (profil, tanda tangan, isian bulanan) hanya tersimpan di
        browser ini via localStorage. Tidak ada server yang menyimpannya.
      </p>

      {toast && (
        <div className={`toast ${toast.err ? "err" : ""}`}>{toast.msg}</div>
      )}
    </div>
  );
}
