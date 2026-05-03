import { NextResponse } from "next/server";
import { fetchSheetData } from "@/lib/sheets-reader";
import type { WeekendPassRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || "";
const SHEET_NAME = process.env.GOOGLE_SHEET_NAME || "Sheet1";

export async function GET() {
  try {
    if (!SPREADSHEET_ID) {
      return NextResponse.json(
        { error: "GOOGLE_SPREADSHEET_ID 환경변수가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    const rows = await fetchSheetData(SPREADSHEET_ID, SHEET_NAME);

    const records: WeekendPassRecord[] = rows
      .filter((row) => row.reservation_id && row.date)
      .map((row) => ({
        date: row.date || "",
        isoweek: Number(row.isoweek) || 0,
        status: row.status || "",
        region1: row.region1 || "",
        clusterName: row.cluster_name || "",
        reservationId: row.reservation_id || "",
        revenue: row.revenue ? Math.round(Number(row.revenue)) : 0,
        profit: row.profit ? Math.round(Number(row.profit)) : null,
        utime: row.utime ? Math.round(Number(row.utime) * 10) / 10 : 0,
        policyId: Number(row.policy_id) || 0,
      }));

    return NextResponse.json(records);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
