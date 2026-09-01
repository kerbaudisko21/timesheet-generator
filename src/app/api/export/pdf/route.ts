import { NextRequest, NextResponse } from "next/server";
import { renderTimesheetHtml } from "@/lib/renderHtml";
import { htmlToPdf } from "@/lib/pdf";
import { monthLabel } from "@/lib/timesheet";
import type { Timesheet } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;
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
    const html = renderTimesheetHtml(ts, { forPdf: true });
    const buf = await htmlToPdf(html);
    const fname = `TS_${safeName(ts.profile?.name || "")}_${safeName(
      monthLabel(ts.month).replace(" ", "_")
    )}.pdf`;
    return new NextResponse(buf as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fname}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("pdf export error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal membuat PDF" },
      { status: 500 }
    );
  }
}
