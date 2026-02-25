"use client";

import Link from "next/link";
import { useMemo } from "react";
import { assets } from "@/lib/mock";

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-white border shadow-sm p-6 space-y-3">
      <div>
        <div className="font-semibold text-[var(--seb-navy)]">{title}</div>
        {subtitle ? <div className="text-xs text-gray-500 mt-1">{subtitle}</div> : null}
      </div>
      {children}
    </div>
  );
}

function KPI({
  label,
  value,
  helper,
  tone = "navy",
}: {
  label: string;
  value: string;
  helper?: string;
  tone?: "navy" | "green" | "amber" | "red" | "blue";
}) {
  const color =
    tone === "green"
      ? "text-[var(--seb-green)]"
      : tone === "amber"
      ? "text-amber-600"
      : tone === "red"
      ? "text-red-600"
      : tone === "blue"
      ? "text-[var(--seb-blue)]"
      : "text-[var(--seb-navy)]";

  return (
    <div className="rounded-xl bg-white border shadow-sm p-5">
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${color}`}>{value}</div>
      {helper ? <div className="mt-1 text-xs text-gray-500">{helper}</div> : null}
    </div>
  );
}

function bandPill(band: string) {
  const cls =
    band === "High"
      ? "border-red-200 bg-red-50 text-red-800"
      : band === "Medium"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-emerald-200 bg-emerald-50 text-emerald-800";

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${cls}`}>
      {band}
    </span>
  );
}

function fmt0(n: number) {
  return new Intl.NumberFormat("en-MY", { maximumFractionDigits: 0 }).format(n);
}

export default function ExecutiveDashboardPage() {
  const stats = useMemo(() => {
    const count = assets.length || 1;

    const fleetRisk = assets.reduce((s, a) => s + a.risk, 0);
    const avgRisk = Math.round(fleetRisk / count);

    const avgHealth = Math.round(assets.reduce((s, a) => s + a.health, 0) / count);
    const avgCrit = Math.round(assets.reduce((s, a) => s + a.criticality, 0) / count);

    const high = assets.filter((a) => a.riskBand === "High").length;
    const med = assets.filter((a) => a.riskBand === "Medium").length;
    const low = assets.filter((a) => a.riskBand === "Low").length;

    const top10 = [...assets].sort((a, b) => b.risk - a.risk).slice(0, 10);
    const top5 = [...assets].sort((a, b) => b.risk - a.risk).slice(0, 5);

    const byClass: Record<string, number> = {};
    assets.forEach((a) => {
      byClass[a.assetClass] = (byClass[a.assetClass] || 0) + a.risk;
    });
    const classRows = Object.entries(byClass)
      .map(([assetClass, risk]) => ({ assetClass, risk: Math.round(risk) }))
      .sort((a, b) => b.risk - a.risk);

    // simple “concentration” metric: share of risk in top 10%
    const sorted = [...assets].sort((a, b) => b.risk - a.risk);
    const top10pctCount = Math.max(1, Math.round(sorted.length * 0.1));
    const top10pctRisk = sorted.slice(0, top10pctCount).reduce((s, a) => s + a.risk, 0);
    const concentrationPct = fleetRisk > 0 ? (top10pctRisk / fleetRisk) * 100 : 0;

    return {
      fleetRisk: Math.round(fleetRisk),
      avgRisk,
      avgHealth,
      avgCrit,
      high,
      med,
      low,
      top10,
      top5,
      classRows,
      top10pctCount,
      concentrationPct: Number(concentrationPct.toFixed(1)),
    };
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--seb-navy)]">Executive Dashboard</h1>
          <p className="text-sm text-gray-600 mt-1">
            Snapshot of fleet health, risk concentration, and top intervention candidates.
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Risk is shown as a <span className="font-medium">0–100 index</span> and aggregated as{" "}
            <span className="font-medium">fleet risk points</span> (sum of asset risk indices).
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs">
          <span className="rounded-full border bg-white px-3 py-1 text-gray-600">
            View: <span className="font-medium text-gray-800">Executive</span>
          </span>
          <span className="rounded-full border bg-white px-3 py-1 text-gray-600">
            Data: <span className="font-medium text-gray-800">Mock</span>
          </span>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <KPI label="Fleet risk points" value={`${fmt0(stats.fleetRisk)} pts`} tone="blue" helper="Sum of asset risk indices" />
        <KPI label="Avg risk" value={`${stats.avgRisk} / 100`} tone="navy" helper="Average across assets" />
        <KPI label="High-risk assets" value={`${stats.high}`} tone={stats.high > 0 ? "red" : "green"} helper="Band = High" />
        <KPI label="Risk concentration" value={`${stats.concentrationPct}%`} tone="amber" helper={`Share in top ${stats.top10pctCount} assets`} />
      </div>

      {/* Main grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Risk mix */}
        <Card title="Risk band mix" subtitle="Distribution across High / Medium / Low">
          {[
            { label: "High", value: stats.high, color: "bg-red-500" },
            { label: "Medium", value: stats.med, color: "bg-amber-500" },
            { label: "Low", value: stats.low, color: "bg-emerald-500" },
          ].map((b) => {
            const total = stats.high + stats.med + stats.low || 1;
            const pct = (b.value / total) * 100;
            return (
              <div key={b.label} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700">{b.label}</span>
                  <span className="font-medium text-gray-900">{b.value}</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full ${b.color}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </Card>

        {/* Risk by class */}
        <Card title="Risk by asset class" subtitle="Top contributors (risk points)">
          <div className="space-y-3">
            {stats.classRows.slice(0, 8).map((r) => {
              const max = stats.classRows[0]?.risk || 1;
              const pct = (r.risk / max) * 100;
              return (
                <div key={r.assetClass} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700">{r.assetClass}</span>
                    <span className="font-medium text-gray-900">{fmt0(r.risk)} pts</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[var(--seb-blue)]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="text-xs text-gray-500 mt-3">
            Full breakdown is available in <span className="font-medium">Portfolio Analytics</span>.
          </div>
        </Card>

        {/* Executive actions */}
        <Card title="Executive cues" subtitle="How leaders use APMS (without Maximo overlap)">
          <ul className="list-disc pl-5 text-sm text-gray-700 space-y-2">
            <li>
              Confirm risk appetite: target reductions in <span className="font-medium">high-risk inventory</span>.
            </li>
            <li>
              Direct focus: fund targeted programs for <span className="font-medium">top-risk cohorts</span>.
            </li>
            <li>
              Validate planning assumptions: ensure <span className="font-medium">data/model health</span> supports decisions.
            </li>
            <li>
              Leave execution to Maximo: APMS provides prioritization, evidence, and scenario outcomes.
            </li>
          </ul>

          <div className="mt-3 flex flex-wrap gap-2">
            <Link className="text-sm underline text-[var(--seb-blue)]" href="/analytics">
              Go to Portfolio Analytics
            </Link>
            <Link className="text-sm underline text-[var(--seb-blue)]" href="/capital">
              Go to Capital Optimization
            </Link>
          </div>
        </Card>
      </div>

      {/* Top 10 */}
      <div className="rounded-xl bg-white border shadow-sm overflow-hidden">
        <div className="p-6 border-b">
          <div className="font-semibold text-[var(--seb-navy)]">Top risk assets (quick shortlist)</div>
          <div className="text-xs text-gray-500 mt-1">
            Click an asset to open the detail page (we’ll enrich with predictive signals next).
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="p-3">Asset</th>
                <th className="p-3">Class</th>
                <th className="p-3">Region</th>
                <th className="p-3">Health</th>
                <th className="p-3">Criticality</th>
                <th className="p-3">Risk</th>
                <th className="p-3">Band</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {stats.top10.map((a) => (
                <tr key={a.id} className="border-t hover:bg-gray-50">
                  <td className="p-3 font-medium">
                    <Link className="underline" href={`/assets/item/${a.id}`}>
                      {a.id}
                    </Link>
                    <div className="text-xs text-gray-500">{a.name}</div>
                  </td>
                  <td className="p-3">{a.assetClass}</td>
                  <td className="p-3">{a.region}</td>
                  <td className="p-3">{a.health}</td>
                  <td className="p-3">{a.criticality}</td>
                  <td className="p-3 font-semibold text-[var(--seb-navy)]">{a.risk}</td>
                  <td className="p-3">{bandPill(a.riskBand)}</td>
                  <td className="p-3 text-gray-700">{a.recommendedAction}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t text-xs text-gray-500">
          Demo note: “Risk points” are a normalized planning proxy (0–100 index per asset), not RM.
        </div>
      </div>
    </div>
  );
}