import { NextRequest, NextResponse } from "next/server";
import { fillTimesheetXlsx } from "@/lib/fillXlsx";
import { monthLabel } from "@/lib/timesheet";
import type { Timesheet } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

// pastikan template ikut ter-bundle di serverless
export const dynamic = "force-dynamic";

function safeName(s: string): string {
  return (s || "Timesheet").replace(/[^\w.-]+/g, "_");
}

export async function POST(req: NextRequest) {
  try {
    const ts = (await req.json()) as Timesheet;
    if (!ts?.month || !Array.isArray(ts.days)) {
      return NextResponse.json({ error: "Payload timesheet tidak valid" }, { status: 400 });
    }
    const buf = await fillTimesheetXlsx(ts);
    const fname = `TS_${safeName(ts.profile?.name || "")}_${safeName(
      monthLabel(ts.month).replace(" ", "_")
    )}.xlsx`;
    return new NextResponse(buf as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fname}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("xlsx export error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal membuat XLSX" },
      { status: 500 }
    );
  }
}
