import { NextRequest, NextResponse } from "next/server";
import { renderOvertimeHtml } from "@/lib/renderOvertimeHtml";
import { htmlToPdf } from "@/lib/pdf";
import { monthLabel, overtimeEntries } from "@/lib/timesheet";
import type { Timesheet } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function safeName(s: string): string {
  return (s || "Lembur").replace(/[^\w.-]+/g, "_");
}

export async function POST(req: NextRequest) {
  try {
    const ts = (await req.json()) as Timesheet;
    if (!ts?.month || !Array.isArray(ts.days)) {
      return NextResponse.json(
        { error: "Payload timesheet tidak valid" },
        { status: 400 }
      );
    }
    if (overtimeEntries(ts).length === 0) {
      return NextResponse.json(
        { error: "Tidak ada hari lembur pada periode ini" },
        { status: 400 }
      );
    }
    const html = renderOvertimeHtml(ts, { forPdf: true });
    const buf = await htmlToPdf(html);
    const fname = `Form_Lembur_${safeName(ts.profile?.name || "")}_${safeName(
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
    console.error("lembur export error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal membuat surat lembur" },
      { status: 500 }
    );
  }
}
