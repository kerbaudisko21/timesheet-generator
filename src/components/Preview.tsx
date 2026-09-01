"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { renderTimesheetHtml } from "@/lib/renderHtml";
import type { Timesheet } from "@/lib/types";

export function Preview({ timesheet }: { timesheet: Timesheet }) {
  const html = useMemo(
    () => renderTimesheetHtml(timesheet, { forPdf: false }),
    [timesheet]
  );
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  // skala isi agar A4 (210mm ≈ 794px) muat di lebar panel
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth - 2;
      setScale(Math.min(1, w / 794));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="preview-scale" ref={wrapRef}>
      <div
        style={{
          width: 794,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          height: scale < 1 ? `calc(1123px * ${scale})` : undefined,
        }}
      >
        <iframe
          title="Preview Timesheet"
          srcDoc={html}
          style={{
            width: 794,
            height: 1123,
            border: "none",
            background: "#fff",
          }}
        />
      </div>
    </div>
  );
}
