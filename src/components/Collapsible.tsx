"use client";

import { ReactNode, useState } from "react";

export function Collapsible({
  title,
  defaultOpen = true,
  right,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  right?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="section">
      <button
        type="button"
        className="section-head"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span>{title}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {right}
          <span style={{ color: "var(--text-dim)" }}>{open ? "▾" : "▸"}</span>
        </span>
      </button>
      {open && <div className="section-content">{children}</div>}
    </div>
  );
}
