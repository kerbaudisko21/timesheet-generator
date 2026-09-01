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
  reconcileDays,
  summarize,
} from "@/lib/timesheet";
import {
  DEFAULT_STATEMENT,
  Profile,
  RATING_LEVELS,
  RatingLevel,
  Timesheet,
} from "@/lib/types";

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
  const [rating, setRating] = usePersistentState<Timesheet["rating"]>(
    "tsg.rating",
    {
      sasaran: "Sangat Memuaskan",
      kompetensi: "Sangat Memuaskan",
      kedisiplinan: "Sangat Memuaskan",
    }
  );
  const [statement, setStatement] = usePersistentState<string>(
    "tsg.statement",
    DEFAULT_STATEMENT
  );

  const [toast, setToast] = useState<Toast>(null);
  const [busy, setBusy] = useState<"" | "xlsx" | "pdf">("");
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
    () => ({ month, profile, days, rating, statement }),
    [month, profile, days, rating, statement]
  );

  const summary = useMemo(() => summarize(timesheet), [timesheet]);

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

  async function download(kind: "xlsx" | "pdf") {
    if (!profile.name.trim()) {
      showToast("Isi dulu nama di bagian Profil.", true);
      return;
    }
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
      const fname =
        m?.[1] ||
        `TS_${profile.name}_${monthLabel(month).replace(" ", "_")}.${kind}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fname;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`${kind.toUpperCase()} berhasil diunduh.`);
    } catch (e) {
      showToast(
        `Gagal membuat ${kind.toUpperCase()}: ${
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

          <Collapsible title="4. Pernyataan & Penilaian User" defaultOpen={false}>
            <div className="field">
              <label htmlFor="stmt">Pernyataan Pegawai</label>
              <textarea
                id="stmt"
                value={statement}
                onChange={(e) => setStatement(e.target.value)}
              />
            </div>
            <div className="grid-2" style={{ marginTop: 12 }}>
              {(
                [
                  ["sasaran", "Sasaran dan Hasil Kerja"],
                  ["kompetensi", "Kompetensi Pendukung"],
                  ["kedisiplinan", "Kedisiplinan"],
                ] as const
              ).map(([key, label]) => (
                <div className="field" key={key}>
                  <label>{label}</label>
                  <select
                    value={rating[key]}
                    onChange={(e) =>
                      setRating((r) => ({
                        ...r,
                        [key]: e.target.value as RatingLevel,
                      }))
                    }
                  >
                    {RATING_LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
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
