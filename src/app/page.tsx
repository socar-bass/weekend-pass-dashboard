"use client";

import { useEffect, useState, useCallback } from "react";
import type { WeekendPassRecord } from "@/lib/types";

const POLICY_LABEL: Record<number, string> = {
  16311: "주말패스A",
  16314: "주말패스B",
};

function fmt(n: number | null | undefined): string {
  if (n == null) return "-";
  return n.toLocaleString("ko-KR");
}

export default function Home() {
  const [records, setRecords] = useState<WeekendPassRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [countdown, setCountdown] = useState<number | null>(null);

  const [filterRegion, setFilterRegion] = useState<string>("전체");
  const [filterStatus, setFilterStatus] = useState<string>("전체");
  const [filterPolicy, setFilterPolicy] = useState<string>("전체");
  const [filterWeek, setFilterWeek] = useState<string>("전체");
  const [search, setSearch] = useState("");

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

  const handleRefresh = useCallback(() => {
    const WAIT_SEC = 40;
    setCountdown(WAIT_SEC);
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "display:none;position:fixed;width:0;height:0;border:0";
    iframe.src = "https://script.google.com/macros/s/AKfycbz4PK_7j6LGwmFr_oesXWj-wpTWq5vNfBguWp2J0TNw2i3fbhLdSzfUY_QuOqhd2iLwhw/exec";
    document.body.appendChild(iframe);
    setTimeout(() => iframe.parentNode?.removeChild(iframe), 15000);
    let remaining = WAIT_SEC;
    const timer = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
        setCountdown(null);
        fetchRecords();
      }
    }, 1000);
  }, [fetchRecords]);

  const regions = ["전체", ...Array.from(new Set(records.map((r) => r.region1))).sort()];
  const statuses = ["전체", "완료", "예약"];
  const policies = ["전체", "16311", "16314"];
  const weeks = [
    "전체",
    ...Array.from(new Set(records.map((r) => String(r.isoweek)))).sort((a, b) => Number(a) - Number(b)),
  ];

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
        r.reservationId.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const completed = filtered.filter((r) => r.status === "완료");
  const reserved = filtered.filter((r) => r.status === "예약");

  const totalRevenue = filtered.reduce((s, r) => s + (r.revenue || 0), 0);
  const totalUtime = filtered.reduce((s, r) => s + (r.utime || 0), 0);

  const completedRevenue = completed.reduce((s, r) => s + (r.revenue || 0), 0);
  const completedProfit = completed.reduce((s, r) => s + (r.profit || 0), 0);
  const completedUtime = completed.reduce((s, r) => s + (r.utime || 0), 0);

  const reservedRevenue = reserved.reduce((s, r) => s + (r.revenue || 0), 0);
  const reservedUtime = reserved.reduce((s, r) => s + (r.utime || 0), 0);

  const gpmPct = completedRevenue > 0 ? Math.round((completedProfit / completedRevenue) * 100) : null;
  const gpmStr = gpmPct != null ? `${gpmPct}%` : "-";

  // 주차별 집계
  const weeklyStats = Array.from(
    filtered.reduce((map, r) => {
      const key = String(r.isoweek);
      const cur = map.get(key) || { week: key, count: 0, completed: 0, reserved: 0, revenue: 0 };
      map.set(key, {
        ...cur,
        count: cur.count + 1,
        completed: cur.completed + (r.status === "완료" ? 1 : 0),
        reserved: cur.reserved + (r.status === "예약" ? 1 : 0),
        revenue: cur.revenue + (r.revenue || 0),
      });
      return map;
    }, new Map<string, { week: string; count: number; completed: number; reserved: number; revenue: number }>())
  )
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([, v]) => v);

  // 지역별 집계
  const regionStats = Array.from(
    filtered.reduce((map, r) => {
      const key = r.region1 || "기타";
      const cur = map.get(key) || {
        region: key,
        count: 0,
        completed: 0,
        revenue: 0,
        completedRevenue: 0,
        profit: 0,
        utime: 0,
        policyA: 0,
        policyB: 0,
      };
      map.set(key, {
        ...cur,
        count: cur.count + 1,
        completed: cur.completed + (r.status === "완료" ? 1 : 0),
        revenue: cur.revenue + (r.revenue || 0),
        completedRevenue: cur.completedRevenue + (r.status === "완료" ? r.revenue || 0 : 0),
        profit: cur.profit + (r.status === "완료" && r.profit != null ? r.profit : 0),
        utime: cur.utime + (r.utime || 0),
        policyA: cur.policyA + (r.policyId === 16311 ? 1 : 0),
        policyB: cur.policyB + (r.policyId === 16314 ? 1 : 0),
      });
      return map;
    }, new Map<string, { region: string; count: number; completed: number; revenue: number; completedRevenue: number; profit: number; utime: number; policyA: number; policyB: number }>())
  )
    .sort((a, b) => b[1].count - a[1].count)
    .map(([, v]) => v);

  // 정책별 집계
  const policyStats = [16311, 16314].map((pid) => {
    const pr = filtered.filter((r) => r.policyId === pid);
    const pc = pr.filter((r) => r.status === "완료");
    const cRev = pc.reduce((s, r) => s + (r.revenue || 0), 0);
    const cProfit = pc.reduce((s, r) => s + (r.profit || 0), 0);
    return {
      id: pid,
      label: POLICY_LABEL[pid],
      count: pr.length,
      revenue: pr.reduce((s, r) => s + (r.revenue || 0), 0),
      completedRevenue: cRev,
      profit: cProfit,
      utime: pr.reduce((s, r) => s + (r.utime || 0), 0),
      completed: pc.length,
    };
  });

  // CSV
  const downloadCSV = () => {
    const headers = ["날짜", "주차", "상태", "지역", "클러스터", "예약ID", "매출(원)", "수익(원)", "이용시간(h)", "정책"];
    const rows = filtered.map((r) => [
      r.date, r.isoweek, r.status, r.region1, r.clusterName, r.reservationId,
      r.revenue ?? "", r.profit ?? "", r.utime, POLICY_LABEL[r.policyId] || r.policyId,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `주말패스_성과_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-sm" style={{ background: "var(--bg-grouped)", color: "var(--text-quaternary)" }}>
        데이터를 불러오는 중...
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-grouped)" }}>
      {/* 헤더 */}
      <header className="socar-topbar flex items-center justify-between" style={{ padding: "12px 24px" }}>
        <div className="flex items-center gap-3">
          <img src="/socar-logo.png" alt="SOCAR" style={{ height: "28px", width: "auto" }} />
          <div style={{ width: "1px", height: "24px", background: "var(--border-base)" }} />
          <span className="text-base font-bold tracking-tight" style={{ color: "var(--socar-blue)" }}>
            주말패스 성과 대시보드
          </span>
          <span
            className="text-xs px-2 py-0.5 font-semibold"
            style={{
              background: "var(--socar-green)",
              color: "white",
              borderRadius: "var(--radius-pill)",
            }}
          >
            LIVE
          </span>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs" style={{ color: "var(--text-quaternary)" }}>
              마지막 조회: {lastUpdated}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={loading || countdown !== null}
            className="socar-btn-medium-outlined-grey"
            style={{ minWidth: "120px", fontSize: "12px", height: "32px" }}
          >
            {countdown !== null ? `동기화 중... (${countdown}초)` : "새로고침"}
          </button>
          <button
            onClick={downloadCSV}
            className="socar-btn-large-fill-blue"
            style={{ minWidth: "auto", height: "32px", padding: "0 14px", fontSize: "12px" }}
          >
            CSV 다운로드
          </button>
        </div>
      </header>

      <div className="max-w-screen-xl mx-auto p-4 space-y-4">
        {error && (
          <div className="socar-alert-error">
            <p className="socar-alert-error-title">{error}</p>
          </div>
        )}

        {/* KPI 요약 */}
        <div className="socar-card overflow-hidden">
          <div
            className="px-5 py-2.5"
            style={{ background: "var(--bg-grouped)", borderBottom: "1px solid var(--border-base)" }}
          >
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
              성과 요약
            </span>
          </div>
          <div>
            <KPIRow
              badge="총계" badgeBg="var(--socar-grey-100)"
              count={filtered.length}
              revenue={totalRevenue} revenueNote=""
              gpm={gpmStr}
              utime={totalUtime}
            />
            <KPIRow
              badge="완료 기준" badgeBg="var(--socar-green)"
              count={completed.length}
              revenue={completedRevenue} revenueNote=""
              gpm={gpmStr}
              utime={completedUtime}
            />
            <KPIRow
              badge="예약 기준" badgeBg="var(--socar-orange)"
              count={reserved.length}
              revenue={reservedRevenue} revenueNote="추정치"
              gpm="미집계"
              utime={reservedUtime}
              isLast
            />
          </div>
        </div>

        {/* 필터 */}
        <div className="socar-card px-4 py-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Select
              value={filterWeek}
              onChange={setFilterWeek}
              options={weeks.map((w) => ({ value: w, label: w === "전체" ? "전체 주차" : `${w}주차` }))}
            />
            <Select
              value={filterRegion}
              onChange={setFilterRegion}
              options={regions.map((r) => ({ value: r, label: r === "전체" ? "전체 지역" : r }))}
            />
            <Select
              value={filterStatus}
              onChange={setFilterStatus}
              options={statuses.map((s) => ({ value: s, label: s === "전체" ? "전체 상태" : s }))}
            />
            <Select
              value={filterPolicy}
              onChange={setFilterPolicy}
              options={policies.map((p) => ({ value: p, label: p === "전체" ? "전체 정책" : POLICY_LABEL[Number(p)] || p }))}
            />
            <input
              type="text"
              placeholder="지역, 클러스터, 예약ID 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="socar-input flex-1 min-w-40"
            />
            <span className="text-xs ml-auto shrink-0" style={{ color: "var(--text-quaternary)" }}>
              {fmt(filtered.length)}건 / 전체 {fmt(records.length)}건
            </span>
          </div>
        </div>

        {/* 차트 2열 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 주차별 추이 */}
          <div className="socar-card p-5">
            <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>주차별 이용건수 추이</h3>
            {weeklyStats.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">데이터 없음</p>
            ) : (
              <WeeklyChart data={weeklyStats} />
            )}
          </div>

          {/* 지역별 */}
          <div className="socar-card p-5">
            <RegionChart data={regionStats.slice(0, 12)} />
          </div>
        </div>

        {/* 하단 2열 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 정책 A/B 비교 */}
          <div className="socar-card p-5">
            <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>주말패스 A / B 비교</h3>
            <PolicyComparison data={policyStats} total={filtered.length} />
          </div>

          {/* 지역별 성과 테이블 */}
          <div className="socar-card p-5">
            <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>지역별 성과 상세</h3>
            <RegionTable data={regionStats.slice(0, 10)} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────── KPI Row ───────── */
function KPIRow({
  badge, badgeBg, count, revenue, revenueNote, gpm, utime, isLast,
}: {
  badge: string; badgeBg: string;
  count: number; revenue: number; revenueNote: string;
  gpm: string; utime: number;
  isLast?: boolean;
}) {
  return (
    <div
      className="px-5 py-4 grid grid-cols-5 items-center gap-6"
      style={{ borderBottom: isLast ? "none" : "1px solid var(--socar-grey-015)" }}
    >
      <div>
        <span
          className="inline-block text-xs font-semibold px-2.5 py-1"
          style={{
            background: badgeBg,
            color: "white",
            borderRadius: "var(--radius-sm)",
            letterSpacing: "var(--letter-spacing-base)",
          }}
        >
          {badge}
        </span>
      </div>
      <KPICell label="이용건수" value={`${count.toLocaleString("ko-KR")}건`} />
      <KPICell
        label={revenueNote ? `매출 총합 (${revenueNote})` : "매출 총합"}
        value={`${revenue.toLocaleString("ko-KR")}원`}
      />
      <KPICell
        label="GPM"
        value={gpm}
        valueColor={gpm === "미집계" ? "var(--text-quaternary)" : "var(--socar-blue)"}
      />
      <KPICell label="이용시간" value={`${Math.round(utime).toLocaleString("ko-KR")}h`} />
    </div>
  );
}

function KPICell({ label, value, valueColor = "var(--text-primary)" }: { label: string; value: string; valueColor?: string }) {
  return (
    <div>
      <div className="text-[11px] mb-1" style={{ color: "var(--text-quaternary)" }}>{label}</div>
      <div className="text-base font-bold leading-tight" style={{ color: valueColor }}>{value}</div>
    </div>
  );
}

/* ───────── Select ───────── */
function Select({
  value, onChange, options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="socar-input"
      style={{ paddingRight: "8px", cursor: "pointer" }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

/* ───────── Weekly Chart ───────── */
function WeeklyChart({
  data,
}: {
  data: { week: string; count: number; completed: number; reserved: number; revenue: number }[];
}) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div key={d.week} className="flex items-center gap-3 text-xs">
          <span className="w-8 shrink-0 text-right" style={{ color: "var(--text-quaternary)" }}>{d.week}주</span>
          <div
            className="flex-1 flex h-6 overflow-hidden relative"
            style={{ background: "var(--socar-grey-015)", borderRadius: "var(--radius-sm)" }}
          >
            <div
              className="h-full"
              style={{ width: `${(d.completed / maxCount) * 100}%`, background: "var(--socar-green)" }}
              title={`완료: ${d.completed}건`}
            />
            <div
              className="h-full"
              style={{ width: `${(d.reserved / maxCount) * 100}%`, background: "var(--socar-orange)" }}
              title={`예약중: ${d.reserved}건`}
            />
          </div>
          <span className="font-semibold w-8 text-right shrink-0" style={{ color: "var(--text-secondary)" }}>{d.count}</span>
          <span className="w-16 text-right shrink-0 hidden sm:block" style={{ color: "var(--text-quaternary)" }}>
            {Math.round(d.revenue / 10000)}만원
          </span>
        </div>
      ))}
      <div className="flex gap-4 pt-1 text-xs" style={{ color: "var(--text-quaternary)" }}>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: "var(--socar-green)" }} />완료
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: "var(--socar-orange)" }} />예약중
        </span>
      </div>
    </div>
  );
}

/* ───────── Region Chart ───────── */
type RegionMetric = "count" | "revenue" | "revenuePerHour" | "gpm";

const REGION_METRICS: { key: RegionMetric; label: string }[] = [
  { key: "count",          label: "이용건수" },
  { key: "revenue",        label: "매출" },
  { key: "revenuePerHour", label: "시간당매출" },
  { key: "gpm",            label: "GPM" },
];

function RegionChart({
  data,
}: {
  data: { region: string; count: number; revenue: number; completedRevenue: number; profit: number; utime: number }[];
}) {
  const [metric, setMetric] = useState<RegionMetric>("count");

  const getValue = (d: typeof data[0]): number => {
    if (metric === "count") return d.count;
    if (metric === "revenue") return d.revenue;
    if (metric === "revenuePerHour") return d.utime > 0 ? Math.round(d.revenue / d.utime) : 0;
    if (metric === "gpm") return d.completedRevenue > 0 ? Math.round((d.profit / d.completedRevenue) * 100) : 0;
    return 0;
  };

  const getLabel = (d: typeof data[0]): string => {
    if (metric === "count") return `${d.count}건`;
    if (metric === "revenue") return `${Math.round(d.revenue / 10000)}만원`;
    if (metric === "revenuePerHour") {
      const v = d.utime > 0 ? Math.round(d.revenue / d.utime) : 0;
      return `${v.toLocaleString()}원/h`;
    }
    if (metric === "gpm") {
      return d.completedRevenue > 0
        ? `${Math.round((d.profit / d.completedRevenue) * 100)}%`
        : "-";
    }
    return "";
  };

  const sorted = [...data].sort((a, b) => getValue(b) - getValue(a));
  const maxVal = Math.max(...sorted.map(getValue), 1);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          지역별 {REGION_METRICS.find((m) => m.key === metric)?.label}
        </h3>
        <div
          className="flex overflow-hidden text-xs"
          style={{ border: "1px solid var(--border-base)", borderRadius: "var(--radius-md)" }}
        >
          {REGION_METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className="px-2.5 py-1 transition-colors"
              style={{
                background: metric === m.key ? "var(--socar-grey-100)" : "transparent",
                color: metric === m.key ? "white" : "var(--text-tertiary)",
                fontWeight: metric === m.key ? 600 : 400,
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2.5">
        {sorted.map((d) => {
          const val = getValue(d);
          const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
          return (
            <div key={d.region} className="flex items-center gap-3 text-xs">
              <span className="w-20 shrink-0 truncate" style={{ color: "var(--text-secondary)" }}>{d.region}</span>
              <div
                className="flex-1 h-4 overflow-hidden"
                style={{ background: "var(--socar-grey-015)", borderRadius: "var(--radius-pill)" }}
              >
                <div
                  className="h-4 transition-all duration-300"
                  style={{ width: `${pct}%`, background: "var(--socar-blue)", borderRadius: "var(--radius-pill)" }}
                />
              </div>
              <span className="font-semibold w-20 text-right shrink-0" style={{ color: "var(--text-primary)" }}>
                {getLabel(d)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ───────── Policy Comparison ───────── */
function PolicyComparison({
  data, total,
}: {
  data: { id: number; label: string; count: number; revenue: number; completedRevenue: number; profit: number; utime: number; completed: number }[];
  total: number;
}) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="space-y-5">
      {data.map((p) => {
        const isA = p.id === 16311;
        const pct = total > 0 ? Math.round((p.count / total) * 100) : 0;
        const gpm = p.completedRevenue > 0 ? Math.round((p.profit / p.completedRevenue) * 100) + "%" : "-";
        const themeBg = isA ? "var(--socar-blue-soft)" : "var(--socar-purple-soft)";
        const themeFg = isA ? "var(--socar-blue-dark)" : "var(--socar-purple-dark)";
        const themeBar = isA ? "var(--socar-blue)" : "var(--socar-purple)";
        return (
          <div key={p.id}>
            <div className="flex items-center justify-between mb-2">
              <span
                className="text-xs font-bold px-2 py-0.5"
                style={{ background: themeBg, color: themeFg, borderRadius: "var(--radius-sm)" }}
              >
                {p.label}
              </span>
              <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{p.count.toLocaleString()}건 ({pct}%)</span>
            </div>
            <div
              className="h-3 overflow-hidden mb-3"
              style={{ background: "var(--socar-grey-015)", borderRadius: "var(--radius-pill)" }}
            >
              <div
                className="h-3"
                style={{ width: `${(p.count / maxCount) * 100}%`, background: themeBar, borderRadius: "var(--radius-pill)" }}
              />
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="p-2.5" style={{ background: "var(--bg-grouped)", borderRadius: "var(--radius-md)" }}>
                <div className="mb-0.5" style={{ color: "var(--text-quaternary)" }}>매출 총합</div>
                <div className="font-semibold" style={{ color: "var(--text-primary)" }}>{Math.round(p.revenue / 10000).toLocaleString()}만원</div>
              </div>
              <div className="p-2.5" style={{ background: "var(--bg-grouped)", borderRadius: "var(--radius-md)" }}>
                <div className="mb-0.5" style={{ color: "var(--text-quaternary)" }}>GPM</div>
                <div className="font-semibold" style={{ color: "var(--socar-blue)" }}>{gpm}</div>
              </div>
              <div className="p-2.5" style={{ background: "var(--bg-grouped)", borderRadius: "var(--radius-md)" }}>
                <div className="mb-0.5" style={{ color: "var(--text-quaternary)" }}>이용시간</div>
                <div className="font-semibold" style={{ color: "var(--text-primary)" }}>{Math.round(p.utime).toLocaleString()}h</div>
              </div>
            </div>
          </div>
        );
      })}

      {/* 정책 설명 */}
      <div
        className="mt-4 overflow-hidden text-xs"
        style={{ border: "1px solid var(--border-base)", borderRadius: "var(--radius-lg)" }}
      >
        <div
          className="px-3 py-2"
          style={{ background: "var(--bg-grouped)", borderBottom: "1px solid var(--border-base)" }}
        >
          <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>쿠폰 정책 안내</span>
        </div>
        <div>
          {/* A */}
          <div className="px-3 py-2.5 flex items-start gap-3" style={{ borderBottom: "1px solid var(--socar-grey-015)" }}>
            <span
              className="mt-0.5 shrink-0 font-bold px-1.5 py-0.5 text-[11px]"
              style={{ background: "var(--socar-blue-soft)", color: "var(--socar-blue-dark)", borderRadius: "var(--radius-sm)" }}
            >A</span>
            <div>
              <div className="font-semibold" style={{ color: "var(--text-primary)" }}>[주말패스] 중형미만 79,900원</div>
              <div className="mt-0.5" style={{ color: "var(--text-quaternary)" }}>정액권</div>
            </div>
          </div>
          {/* B */}
          <div className="px-3 py-2.5 flex items-start gap-3" style={{ borderBottom: "1px solid var(--socar-grey-015)" }}>
            <span
              className="mt-0.5 shrink-0 font-bold px-1.5 py-0.5 text-[11px]"
              style={{ background: "var(--socar-purple-soft)", color: "var(--socar-purple-dark)", borderRadius: "var(--radius-sm)" }}
            >B</span>
            <div>
              <div className="font-semibold" style={{ color: "var(--text-primary)" }}>[주말패스] 중형이상 99,900원</div>
              <div className="mt-0.5" style={{ color: "var(--text-quaternary)" }}>정액권</div>
            </div>
          </div>
          {/* 쿠폰 조건 */}
          <div className="px-3 py-3" style={{ borderBottom: "1px solid var(--socar-grey-015)" }}>
            <div className="font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>쿠폰 조건</div>
            <div className="space-y-1 leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
              <div><span className="mr-1" style={{ color: "var(--text-quaternary)" }}>a.</span>사용 불가 일자: 3/31 ~ 6/25, 3개월 &apos;일, 월, 화, 수, 목&apos; / 대여가능 &apos;금, 토&apos; / 반납은 &apos;월, 화&apos;까지 가능</div>
              <div><span className="mr-1" style={{ color: "var(--text-quaternary)" }}>b.</span>쿠폰 사용(반납) 일자: ~6/29(월)까지</div>
              <div><span className="mr-1" style={{ color: "var(--text-quaternary)" }}>c.</span>사용 종료: 6/29(월) 24시까지</div>
              <div><span className="mr-1" style={{ color: "var(--text-quaternary)" }}>d.</span>최소시간: 48시간</div>
              <div><span className="mr-1" style={{ color: "var(--text-quaternary)" }}>e.</span>최대시간: 64시간</div>
              <div><span className="mr-1" style={{ color: "var(--text-quaternary)" }}>f.</span>유효기간: 1일</div>
              <div><span className="mr-1" style={{ color: "var(--text-quaternary)" }}>g.</span>차종 제한: EV, RV, 수입 제외</div>
              <div><span className="mr-1" style={{ color: "var(--text-quaternary)" }}>h.</span>운행 타입: 왕복전용</div>
            </div>
          </div>
          {/* 발급 방식 */}
          <div className="px-3 py-3">
            <div className="font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>발급 방식</div>
            <div className="space-y-1 leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
              <div><span className="mr-1" style={{ color: "var(--text-quaternary)" }}>a.</span>해당 클러스터 내 쏘카존 클릭 시 자동발급</div>
              <div><span className="mr-1" style={{ color: "var(--text-quaternary)" }}>b.</span>차종 리스트 배너</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────── Region Table ───────── */
function RegionTable({
  data,
}: {
  data: { region: string; count: number; completed: number; revenue: number; completedRevenue: number; profit: number; policyA: number; policyB: number }[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr style={{ borderBottom: "2px solid var(--border-base)" }}>
            <th className="text-left pb-2 font-semibold" style={{ color: "var(--text-tertiary)" }}>지역</th>
            <th className="text-right pb-2 font-semibold" style={{ color: "var(--text-tertiary)" }}>전체</th>
            <th className="text-right pb-2 font-semibold" style={{ color: "var(--text-tertiary)" }}>완료</th>
            <th className="text-right pb-2 font-semibold" style={{ color: "var(--text-tertiary)" }}>완료율</th>
            <th className="text-right pb-2 font-semibold" style={{ color: "var(--socar-blue)" }}>A</th>
            <th className="text-right pb-2 font-semibold" style={{ color: "var(--socar-purple)" }}>B</th>
            <th className="text-right pb-2 font-semibold" style={{ color: "var(--text-tertiary)" }}>매출(만원)</th>
            <th className="text-right pb-2 font-semibold" style={{ color: "var(--text-tertiary)" }}>GPM</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => {
            const completionRate = d.count > 0 ? Math.round((d.completed / d.count) * 100) : 0;
            const gpm = d.completedRevenue > 0 ? Math.round((d.profit / d.completedRevenue) * 100) + "%" : "-";
            return (
              <tr
                key={d.region}
                className="socar-table-row transition-colors"
                style={{ borderBottom: "1px solid var(--socar-grey-015)" }}
              >
                <td className="py-2.5 font-medium" style={{ color: "var(--text-primary)" }}>{d.region}</td>
                <td className="py-2.5 text-right" style={{ color: "var(--text-secondary)" }}>{d.count}</td>
                <td className="py-2.5 text-right font-medium" style={{ color: "var(--socar-green-dark)" }}>{d.completed}</td>
                <td className="py-2.5 text-right" style={{ color: "var(--text-tertiary)" }}>{completionRate}%</td>
                <td className="py-2.5 text-right font-medium" style={{ color: "var(--socar-blue)" }}>{d.policyA}</td>
                <td className="py-2.5 text-right font-medium" style={{ color: "var(--socar-purple)" }}>{d.policyB}</td>
                <td className="py-2.5 text-right" style={{ color: "var(--text-primary)" }}>{Math.round(d.revenue / 10000).toLocaleString()}</td>
                <td className="py-2.5 text-right font-semibold" style={{ color: "var(--socar-blue)" }}>{gpm}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

