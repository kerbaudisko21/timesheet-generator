"use client";

import { useMemo } from "react";
import { DayEntry, DayStatus, STATUS_LABELS } from "@/lib/types";
import {
  autoActivityFor,
  dayName,
  isWeekend,
  pad2,
  workedMinutes,
} from "@/lib/timesheet";

type Props = {
  days: DayEntry[];
  defaultStart: string;
  defaultEnd: string;
  onChange: (days: DayEntry[]) => void;
};

const STATUS_ORDER: DayStatus[] = [
  "work",
  "weekend",
  "holiday",
  "leave",
  "permit",
  "sick",
  "absent",
];

function fmtDayNum(dateIso: string): string {
  return dateIso.split("-")[2];
}

export function DayEditor({ days, defaultStart, defaultEnd, onChange }: Props) {
  const patch = (idx: number, next: Partial<DayEntry>) => {
    onChange(
      days.map((d, i) => {
        if (i !== idx) return d;
        const merged = { ...d, ...next };
        // saat status berubah dari/ke non-work, rapikan field
        if (next.status && next.status !== d.status) {
          if (next.status === "work") {
            merged.start = d.start || defaultStart;
            merged.end = d.end || defaultEnd;
            if (
              !d.activity ||
              d.activity === autoActivityFor(d.status, d.date)
            ) {
              merged.activity = "";
            }
          } else {
            merged.start = "";
            merged.end = "";
            if (!d.activity || d.activity.trim() === "") {
              merged.activity = autoActivityFor(next.status, d.date);
            }
          }
        }
        return merged;
      })
    );
  };

  const fillAllWorkdays = () => {
    onChange(
      days.map((d) => {
        if (d.status !== "work") return d;
        return { ...d, start: defaultStart, end: defaultEnd };
      })
    );
  };

  const copyFirstActivity = () => {
    const first = days.find((d) => d.status === "work" && d.activity.trim());
    if (!first) return;
    onChange(
      days.map((d) =>
        d.status === "work" && !d.activity.trim()
          ? { ...d, activity: first.activity }
          : d
      )
    );
  };

  const clearActivities = () => {
    onChange(
      days.map((d) =>
        d.status === "work" ? { ...d, activity: "" } : d
      )
    );
  };

  const totals = useMemo(() => {
    let mins = 0;
    let workCount = 0;
    for (const d of days) {
      if (d.status === "work") {
        workCount++;
        mins += workedMinutes(d);
      }
    }
    return {
      label: `${Math.floor(mins / 60)}:${pad2(mins % 60)}`,
      workCount,
    };
  }, [days]);

  return (
    <div>
      <div className="days-toolbar">
        <button type="button" className="btn" onClick={fillAllWorkdays}>
          Isi semua hari kerja {defaultStart}–{defaultEnd}
        </button>
        <button type="button" className="btn ghost" onClick={copyFirstActivity}>
          Salin aktivitas pertama ke yang kosong
        </button>
        <button type="button" className="btn ghost" onClick={clearActivities}>
          Kosongkan aktivitas
        </button>
        <span className="spacer" />
        <span className="badge">
          {totals.workCount} hari kerja · total {totals.label}
        </span>
      </div>

      <div className="day-list">
        {days.map((d, idx) => {
          const weekend = isWeekend(d.date);
          const off = d.status !== "work";
          const cls = [
            "day-row",
            d.status === "weekend" || weekend ? "is-weekend" : "",
            off && d.status !== "weekend" ? "is-off" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <div className={cls} key={d.date}>
              <div className="date">
                {fmtDayNum(d.date)} {shortMon(d.date)}
                <span>{dayName(d.date)}</span>
              </div>

              <select
                value={d.status}
                onChange={(e) =>
                  patch(idx, { status: e.target.value as DayStatus })
                }
                aria-label={`Status ${d.date}`}
              >
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>

              <div className={`time-cell ${d.status === "work" ? "" : "hidden"}`}>
                <input
                  type="time"
                  value={d.start}
                  onChange={(e) => patch(idx, { start: e.target.value })}
                  aria-label={`Jam mulai ${d.date}`}
                />
              </div>
              <div className={`time-cell ${d.status === "work" ? "" : "hidden"}`}>
                <input
                  type="time"
                  value={d.end}
                  onChange={(e) => patch(idx, { end: e.target.value })}
                  aria-label={`Jam selesai ${d.date}`}
                />
              </div>

              <div className="act-cell">
                <textarea
                  className="act-input"
                  rows={
                    Math.min(
                      6,
                      Math.max(1, d.activity.split(/\r?\n/).length)
                    )
                  }
                  value={d.activity}
                  placeholder={
                    d.status === "work"
                      ? "Aktivitas / remark… (Enter untuk baris baru, otomatis dinomori)"
                      : autoActivityFor(d.status, d.date)
                  }
                  onChange={(e) => patch(idx, { activity: e.target.value })}
                  aria-label={`Aktivitas ${d.date}`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function shortMon(dateIso: string): string {
  const m = Number(dateIso.split("-")[1]);
  return [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "Mei",
    "Jun",
    "Jul",
    "Agu",
    "Sep",
    "Okt",
    "Nov",
    "Des",
  ][m - 1];
}
