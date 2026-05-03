"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import type { WeekendPassRecord } from "@/lib/types";

const POLICY_LABEL: Record<number, string> = {
  16311: "주말패스A",
  16314: "주말패스B",
};

function fmt(n: number | null | undefined): string {
  if (n == null) return "-";
  return n.toLocaleString("ko-KR");
}

function fmtWon(n: number | null | undefined): string {
  if (n == null) return "-";
  return n.toLocaleString("ko-KR") + "원";
}

const DEFAULT_COL_WIDTHS = [90, 55, 60, 90, 160, 110, 90, 90, 70, 90];

export default function Home() {
  const [records, setRecords] = useState<WeekendPassRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const [filterRegion, setFilterRegion] = useState<string>("전체");
  const [filterStatus, setFilterStatus] = useState<string>("전체");
  const [filterPolicy, setFilterPolicy] = useState<string>("전체");
  const [filterWeek, setFilterWeek] = useState<string>("전체");
  const [search, setSearch] = useState("");

  const [colWidths, setColWidths] = useState<number[]>(DEFAULT_COL_WIDTHS);
  const dragging = useRef<{ col: number; startX: number; startW: number } | null>(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/records");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: WeekendPassRecord[] = await res.json();
      if ("error" in data) throw new Error((data as unknown as { error: string }).error);
      setRecords(data);
      setLastUpdated(new Date().toLocaleString("ko-KR"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "데이터 로드 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // 드래그 리사이즈
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const diff = e.clientX - dragging.current.startX;
      setColWidths((prev) => {
        const next = [...prev];
        next[dragging.current!.col] = Math.max(40, dragging.current!.startW + diff);
        return next;
      });
    };
    const onUp = () => {
      dragging.current = null;
      document.body.style.cursor = "";
      document.body.classList.remove("select-none");
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const startDrag = (col: number, e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = { col, startX: e.clientX, startW: colWidths[col] };
    document.body.style.cursor = "col-resize";
    document.body.classList.add("select-none");
  };

  // 필터 옵션 목록
  const regions = ["전체", ...Array.from(new Set(records.map((r) => r.region1))).sort()];
  const statuses = ["전체", "완료", "예약"];
  const policies = ["전체", ...Array.from(new Set(records.map((r) => String(r.policyId)))).sort()];
  const weeks = ["전체", ...Array.from(new Set(records.map((r) => String(r.isoweek)))).sort((a, b) => Number(a) - Number(b))];

  const filtered = records.filter((r) => {
    if (filterRegion !== "전체" && r.region1 !== filterRegion) return false;
    if (filterStatus !== "전체" && r.status !== filterStatus) return false;
    if (filterPolicy !== "전체" && String(r.policyId) !== filterPolicy) return false;
    if (filterWeek !== "전체" && String(r.isoweek) !== filterWeek) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        r.region1.toLowerCase().includes(q) ||
        r.clusterName.toLowerCase().includes(q) ||
        r.reservationId.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // 요약 지표
  const totalCount = filtered.length;
  const completedCount = filtered.filter((r) => r.status === "완료").length;
  const reservedCount = filtered.filter((r) => r.status === "예약").length;
  const totalRevenue = filtered.reduce((s, r) => s + (r.revenue || 0), 0);
  const totalProfit = filtered.reduce((s, r) => s + (r.profit || 0), 0);
  const totalUtime = filtered.reduce((s, r) => s + (r.utime || 0), 0);

  // 지역별 집계
  const regionStats = Array.from(
    filtered.reduce((map, r) => {
      const key = r.region1 || "기타";
      const cur = map.get(key) || { count: 0, revenue: 0 };
      map.set(key, { count: cur.count + 1, revenue: cur.revenue + (r.revenue || 0) });
      return map;
    }, new Map<string, { count: number; revenue: number }>())
  ).sort((a, b) => b[1].count - a[1].count);

  // CSV 다운로드
  const downloadCSV = () => {
    const headers = ["날짜", "주차(ISO)", "상태", "지역", "클러스터", "예약ID", "매출(원)", "수익(원)", "이용시간(h)", "정책"];
    const rows = filtered.map((r) => [
      r.date,
      r.isoweek,
      r.status,
      r.region1,
      r.clusterName,
      r.reservationId,
      r.revenue ?? "",
      r.profit ?? "",
      r.utime,
      POLICY_LABEL[r.policyId] || r.policyId,
    ]);
    const csv = [headers, ...rows].map((row) => row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `주말패스_성과_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* 헤더 */}
      <header className="bg-slate-700 text-white px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold tracking-tight">주말패스 성과 대시보드</span>
          <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">LIVE</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-300">
          {lastUpdated && <span>마지막 조회: {lastUpdated}</span>}
          <button
            onClick={fetchRecords}
            disabled={loading}
            className="bg-slate-600 hover:bg-slate-500 text-white text-xs px-3 py-1.5 rounded transition-colors disabled:opacity-50"
          >
            {loading ? "로딩중..." : "새로고침"}
          </button>
        </div>
      </header>

      {/* 요약 카드 */}
      <div className="px-4 pt-3 pb-2 shrink-0">
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
          <SummaryCard label="전체 예약" value={fmt(totalCount) + "건"} color="blue" />
          <SummaryCard label="완료" value={fmt(completedCount) + "건"} color="green" />
          <SummaryCard label="예약중" value={fmt(reservedCount) + "건"} color="amber" />
          <SummaryCard label="총 매출" value={fmtWon(totalRevenue)} color="purple" />
          <SummaryCard label="총 수익" value={fmtWon(totalProfit)} color="teal" />
          <SummaryCard label="총 이용시간" value={fmt(Math.round(totalUtime)) + "h"} color="orange" />
        </div>

        {/* 지역별 카드 */}
        {regionStats.length > 0 && (
          <div className="flex gap-2 mt-2 flex-wrap">
            {regionStats.map(([region, stat]) => (
              <button
                key={region}
                onClick={() => setFilterRegion(filterRegion === region ? "전체" : region)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-all ${
                  filterRegion === region
                    ? "bg-slate-700 text-white border-slate-700"
                    : "bg-white border-slate-200 hover:border-slate-400 text-slate-700"
                }`}
              >
                <span className="font-medium">{region}</span>
                <span className="text-xs opacity-70">{fmt(stat.count)}건</span>
                <span className="text-xs opacity-70">{Math.round(stat.revenue / 10000)}만원</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 필터 + 검색 */}
      <div className="px-4 pb-2 shrink-0 flex items-center gap-2 flex-wrap">
        <select
          value={filterWeek}
          onChange={(e) => setFilterWeek(e.target.value)}
          className="border border-slate-300 rounded px-2 py-1.5 text-sm bg-white"
        >
          {weeks.map((w) => (
            <option key={w} value={w}>
              {w === "전체" ? "전체 주차" : `${w}주차`}
            </option>
          ))}
        </select>

        <select
          value={filterRegion}
          onChange={(e) => setFilterRegion(e.target.value)}
          className="border border-slate-300 rounded px-2 py-1.5 text-sm bg-white"
        >
          {regions.map((r) => (
            <option key={r} value={r}>{r === "전체" ? "전체 지역" : r}</option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-slate-300 rounded px-2 py-1.5 text-sm bg-white"
        >
          {statuses.map((s) => (
            <option key={s} value={s}>{s === "전체" ? "전체 상태" : s}</option>
          ))}
        </select>

        <select
          value={filterPolicy}
          onChange={(e) => setFilterPolicy(e.target.value)}
          className="border border-slate-300 rounded px-2 py-1.5 text-sm bg-white"
        >
          {policies.map((p) => (
            <option key={p} value={p}>
              {p === "전체" ? "전체 정책" : POLICY_LABEL[Number(p)] || p}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="지역, 클러스터, 예약ID 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-slate-300 rounded px-3 py-1.5 text-sm flex-1 min-w-48"
        />

        <button
          onClick={() => setColWidths(DEFAULT_COL_WIDTHS)}
          className="border border-slate-300 rounded px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50 whitespace-nowrap"
        >
          열 너비 초기화
        </button>

        <button
          onClick={downloadCSV}
          className="bg-slate-700 text-white rounded px-3 py-1.5 text-xs hover:bg-slate-600 whitespace-nowrap"
        >
          CSV 다운로드
        </button>

        <span className="text-xs text-slate-500 ml-auto">{fmt(filtered.length)}건 / 전체 {fmt(records.length)}건</span>
      </div>

      {/* 에러 */}
      {error && (
        <div className="mx-4 mb-2 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm shrink-0">
          {error}
        </div>
      )}

      {/* 테이블 */}
      <div className="flex-1 overflow-auto px-4 pb-4">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-slate-500">
            데이터를 불러오는 중...
          </div>
        ) : (
          <table className="w-full text-xs border-collapse" style={{ tableLayout: "fixed" }}>
            <colgroup>
              {colWidths.map((w, i) => (
                <col key={i} style={{ width: `${w}px` }} />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-700 text-white">
                {[
                  "날짜", "주차", "상태", "지역", "클러스터",
                  "예약ID", "매출(원)", "수익(원)", "이용(h)", "정책"
                ].map((label, i) => (
                  <th
                    key={i}
                    className="px-2 py-2 text-center font-semibold relative select-none whitespace-nowrap overflow-hidden text-ellipsis"
                  >
                    {label}
                    <span
                      onMouseDown={(e) => startDrag(i, e)}
                      className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-white/20"
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-10 text-slate-400">
                    조건에 맞는 데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                filtered.map((r, idx) => (
                  <tr
                    key={`${r.reservationId}-${idx}`}
                    className={`border-b border-slate-100 hover:bg-slate-50 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}
                  >
                    <td className="px-2 py-1.5 text-center text-slate-600 whitespace-nowrap overflow-hidden text-ellipsis">{r.date}</td>
                    <td className="px-2 py-1.5 text-center text-slate-500">{r.isoweek}주</td>
                    <td className="px-2 py-1.5 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        r.status === "완료"
                          ? "bg-green-100 text-green-700"
                          : "bg-amber-100 text-amber-700"
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-center text-slate-600 whitespace-nowrap overflow-hidden text-ellipsis">{r.region1}</td>
                    <td className="px-2 py-1.5 text-left text-slate-700 whitespace-nowrap overflow-hidden text-ellipsis" title={r.clusterName}>{r.clusterName}</td>
                    <td className="px-2 py-1.5 text-center text-slate-500 font-mono">{r.reservationId}</td>
                    <td className="px-2 py-1.5 text-right font-medium text-slate-800">
                      {r.status === "예약" ? (
                        <span className="text-amber-600">{fmt(r.revenue)}</span>
                      ) : (
                        fmt(r.revenue)
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      {r.profit == null ? (
                        <span className="text-slate-400">-</span>
                      ) : r.profit < 0 ? (
                        <span className="text-red-500">{fmt(r.profit)}</span>
                      ) : (
                        <span className="text-slate-800">{fmt(r.profit)}</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-center text-slate-600">{r.utime}</td>
                    <td className="px-2 py-1.5 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-xs ${
                        r.policyId === 16311
                          ? "bg-blue-100 text-blue-700"
                          : "bg-violet-100 text-violet-700"
                      }`}>
                        {POLICY_LABEL[r.policyId] || r.policyId}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "blue" | "green" | "amber" | "purple" | "teal" | "orange";
}) {
  const colorMap = {
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    green: "border-green-200 bg-green-50 text-green-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    purple: "border-purple-200 bg-purple-50 text-purple-700",
    teal: "border-teal-200 bg-teal-50 text-teal-700",
    orange: "border-orange-200 bg-orange-50 text-orange-700",
  };
  return (
    <div className={`rounded-lg border px-3 py-2 ${colorMap[color]}`}>
      <div className="text-xs opacity-70 mb-0.5">{label}</div>
      <div className="text-base font-bold">{value}</div>
    </div>
  );
}
