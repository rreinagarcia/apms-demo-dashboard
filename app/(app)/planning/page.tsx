"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { assets } from "@/lib/mock";

type ScenarioKey = "base" | "constrained" | "accelerated";

const SCENARIOS: { key: ScenarioKey; label: string; desc: string }[] = [
  {
    key: "base",
    label: "Base Plan",
    desc: "Balanced risk retirement aligned to current capability and funding assumptions.",
  },
  {
    key: "constrained",
    label: "Budget Constrained",
    desc: "Lower funding and slower execution; risk retirement delayed.",
  },
  {
    key: "accelerated",
    label: "Reliability Accelerated",
    desc: "Higher focus on reliability outcomes; faster retirement of highest-risk cohorts.",
  },
];

function Card({ title, subtitle, children }: any) {
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
  tone,
}: {
  label: string;
  value: string;
  tone?: "green" | "blue" | "gray" | "amber";
}) {
  const color =
    tone === "green"
      ? "text-[var(--seb-green)]"
      : tone === "amber"
      ? "text-amber-600"
      : tone === "blue"
      ? "text-[var(--seb-blue)]"
      : "text-[var(--seb-navy)]";

  return (
    <div className="rounded-xl bg-white border shadow-sm p-5">
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function pill(text: string, tone: "blue" | "green" | "gray") {
  const cls =
    tone === "green"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "blue"
      ? "border-blue-200 bg-blue-50 text-blue-800"
      : "border-gray-200 bg-gray-50 text-gray-700";
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${cls}`}>{text}</span>;
}

function fmt(n: number, digits = 0) {
  return new Intl.NumberFormat("en-MY", { maximumFractionDigits: digits }).format(n);
}

function computeTrajectory(baselineFleetRisk: number, years: number[], yearlyRetirePct: number[]) {
  return years.map((y, i) => {
    const cumulative = yearlyRetirePct.slice(0, i + 1).reduce((s, p) => s + p, 0);
    const risk = Math.max(0, Math.round(baselineFleetRisk * (1 - cumulative)));
    return { year: y, risk, cumulativeRetiredPct: cumulative };
  });
}

export default function PlanningPage() {
  const [scenario, setScenario] = useState<ScenarioKey>("base");

  // 5-year horizon
  const years = useMemo(() => [2025, 2026, 2027, 2028, 2029], []);

  // Baseline fleet risk points (sum of risk 0–100 index)
  const baselineFleetRisk = useMemo(() => Math.round(assets.reduce((s, a) => s + a.risk, 0)), []);

  // Baseline by asset class (risk points)
  const baselineByClass = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of assets) map[a.assetClass] = (map[a.assetClass] || 0) + a.risk;
    return Object.entries(map)
      .map(([assetClass, risk]) => ({ assetClass, risk: Math.round(risk) }))
      .sort((a, b) => b.risk - a.risk);
  }, []);

  /**
   * SCENARIO PARAMETERS
   * - yearlyRetirePct: portfolio-level risk retirement assumption
   * - totexRMmPerYear: strategic envelope (NOT a project list)
   * - capexShare: split for comms (separate CAPEX/OPEX budgets exist annually)
   * - rmPerRiskPoint: conversion from risk points -> expected loss proxy (RM per risk point)
   */
  const scenarioParams = useMemo(() => {
    const params: Record<
      ScenarioKey,
      {
        yearlyRetirePct: number[];
        classBias: Record<string, number>;
        totexRMmPerYear: number; // RM m/year (strategic)
        capexShare: number; // portion of TOTEX treated as CAPEX (rest OPEX)
        rmPerRiskPoint: number; // RM per risk point (proxy)
      }
    > = {
      base: {
        yearlyRetirePct: [0.0, 0.05, 0.04, 0.03, 0.02], // cumulative ~14%
        classBias: {},
        totexRMmPerYear: 130, // example strategic totex envelope
        capexShare: 0.72,
        rmPerRiskPoint: 0.06, // RMm per risk point (proxy)
      },
      constrained: {
        yearlyRetirePct: [0.0, 0.03, 0.03, 0.02, 0.02], // slower
        classBias: {},
        totexRMmPerYear: 95,
        capexShare: 0.68,
        rmPerRiskPoint: 0.06,
      },
      accelerated: {
        yearlyRetirePct: [0.0, 0.08, 0.06, 0.04, 0.03], // faster
        classBias: {
          "Power Transformer": 1.15,
          "Distribution Transformer": 1.05,
          "Switchgear (GIS/AIS)": 1.10,
          "Circuit Breaker": 1.05,
        },
        totexRMmPerYear: 170,
        capexShare: 0.75,
        rmPerRiskPoint: 0.06,
      },
    };
    return params;
  }, []);

  const selectedScenario = useMemo(() => SCENARIOS.find((s) => s.key === scenario)!, [scenario]);

  // Fleet risk trajectory
  const fleetTrajectory = useMemo(() => {
    return computeTrajectory(baselineFleetRisk, years, scenarioParams[scenario].yearlyRetirePct);
  }, [baselineFleetRisk, years, scenarioParams, scenario]);

  // Risk → Expected Loss proxy by year (RM m)
  const lossTrajectory = useMemo(() => {
    const k = scenarioParams[scenario].rmPerRiskPoint;
    return fleetTrajectory.map((d) => ({
      year: d.year,
      expectedLossRMm: Number((d.risk * k).toFixed(1)),
    }));
  }, [fleetTrajectory, scenarioParams, scenario]);

  // Asset-class trajectory (risk points) for selected scenario
  const classTrajectory = useMemo(() => {
    const retirePct = scenarioParams[scenario].yearlyRetirePct;
    const bias = scenarioParams[scenario].classBias || {};

    const baseMap: Record<string, number> = {};
    for (const r of baselineByClass) baseMap[r.assetClass] = r.risk;

    const classRows = Object.keys(baseMap);

    const weighted = classRows.map((c) => ({ c, w: (bias[c] ?? 1.0) * baseMap[c] }));
    const sumW = weighted.reduce((s, x) => s + x.w, 0) || 1;

    const byYear: Record<number, { assetClass: string; risk: number; share: number }[]> = {};

    years.forEach((y, i) => {
      const cumulative = retirePct.slice(0, i + 1).reduce((s, p) => s + p, 0);

      let remainingMap: Record<string, number> = {};
      if (scenario !== "accelerated") {
        for (const c of classRows) remainingMap[c] = Math.max(0, Math.round(baseMap[c] * (1 - cumulative)));
      } else {
        const fleetRisk = Math.max(0, Math.round(baselineFleetRisk * (1 - cumulative)));
        for (const c of classRows) {
          const share = ((bias[c] ?? 1.0) * baseMap[c]) / sumW;
          remainingMap[c] = Math.max(0, Math.round(fleetRisk * share));
        }
      }

      const total = Object.values(remainingMap).reduce((s, v) => s + v, 0) || 1;
      byYear[y] = classRows
        .map((assetClass) => ({
          assetClass,
          risk: remainingMap[assetClass],
          share: remainingMap[assetClass] / total,
        }))
        .sort((a, b) => b.risk - a.risk);
    });

    return byYear;
  }, [scenario, scenarioParams, baselineByClass, years, baselineFleetRisk]);

  // Concentration metrics
  const concentration = useMemo(() => {
    const sorted = [...assets].sort((a, b) => b.risk - a.risk);
    const n = sorted.length || 1;

    const top10pctCount = Math.max(1, Math.round(n * 0.1));
    const top10pctRisk = sorted.slice(0, top10pctCount).reduce((s, a) => s + a.risk, 0);
    const fleetRisk = sorted.reduce((s, a) => s + a.risk, 0) || 1;

    const pctTop10 = (top10pctRisk / fleetRisk) * 100;
    const highRisk = sorted.filter((a) => a.riskBand === "High").length;

    return {
      fleetRisk: Math.round(fleetRisk),
      pctTop10: Number(pctTop10.toFixed(1)),
      top10pctCount,
      highRisk,
    };
  }, []);

  // Scenario comparison (side-by-side) with TOTEX + Expected Loss
  const scenarioComparison = useMemo(() => {
    const highRisk2025 = assets.filter((a) => a.riskBand === "High").length;

    return (["base", "constrained", "accelerated"] as ScenarioKey[]).map((k) => {
      const traj = computeTrajectory(baselineFleetRisk, years, scenarioParams[k].yearlyRetirePct);
      const start = traj[0].risk;
      const end = traj[traj.length - 1].risk;

      const retired = start - end;
      const retiredPct = start > 0 ? (retired / start) * 100 : 0;

      // proxy high-risk count in 2029 scaled by remaining fleet risk ratio
      const ratio = start > 0 ? end / start : 1;
      const highRisk2029 = Math.max(0, Math.round(highRisk2025 * ratio));

      // TOTEX
      const totexPerYear = scenarioParams[k].totexRMmPerYear;
      const totex5y = totexPerYear * years.length;

      const capex5y = totex5y * scenarioParams[k].capexShare;
      const opex5y = totex5y * (1 - scenarioParams[k].capexShare);

      // Expected loss proxy (RMm) per year, then 5y total
      const rmPerPoint = scenarioParams[k].rmPerRiskPoint;
      const expectedLoss5y = traj.reduce((s, d) => s + d.risk * rmPerPoint, 0);

      // Avoided loss vs constrained (reference)
      // We'll compute later after we build all rows, but do it simply by returning expectedLoss5y.
      const label = SCENARIOS.find((s) => s.key === k)?.label ?? k;

      return {
        key: k,
        label,
        start,
        end,
        retired,
        retiredPct,
        highRisk2025,
        highRisk2029,
        totexPerYear,
        totex5y,
        capex5y,
        opex5y,
        expectedLoss5y, // RMm proxy
      };
    });
  }, [assets, baselineFleetRisk, years, scenarioParams]);

  const constrainedLoss = useMemo(() => {
    const c = scenarioComparison.find((r) => r.key === "constrained");
    return c ? c.expectedLoss5y : 0;
  }, [scenarioComparison]);

  // chart scaling
  const maxRisk = useMemo(() => Math.max(...fleetTrajectory.map((d) => d.risk), 1), [fleetTrajectory]);
  const maxLoss = useMemo(() => Math.max(...lossTrajectory.map((d) => d.expectedLossRMm), 1), [lossTrajectory]);

  // scope guardrails
  const scopeNote = useMemo(
    () => [
      "This page focuses on multi-year outcomes (risk + exposure trajectory), not work order execution (Maximo).",
      "Scenario TOTEX is a strategic envelope (RMm/year), not an annual intervention optimizer.",
      "Annual selection stays in “Capital Optimization – Annual Plan”.",
    ],
    []
  );

  const y0 = years[0];
  const yN = years[years.length - 1];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--seb-navy)]">5-Year Strategic Asset Plan</h1>
          <p className="text-sm text-gray-600">
            Scenario-based portfolio trajectory (2025–2029). Risk shown as aggregated{" "}
            <span className="font-medium">fleet risk points</span> (sum of 0–100 asset risk indices).
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link className="underline text-[var(--seb-blue)]" href="/analytics">
            Portfolio Analytics
          </Link>
          <Link className="underline text-[var(--seb-blue)]" href="/capital">
            Capital Optimization – Annual Plan
          </Link>
        </div>
      </div>

      {/* Scenario toggle */}
      <div className="rounded-xl bg-white border shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="font-semibold text-[var(--seb-navy)]">Scenario</div>
            <div className="text-xs text-gray-500 mt-1">{selectedScenario.desc}</div>
          </div>

          <div className="inline-flex rounded-xl border bg-gray-50 p-1">
            {SCENARIOS.map((s) => {
              const active = s.key === scenario;
              return (
                <button
                  key={s.key}
                  onClick={() => setScenario(s.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    active ? "bg-white shadow-sm text-[var(--seb-navy)]" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid md:grid-cols-4 gap-5">
        <KPI label="Fleet risk (2025)" value={`${fmt(fleetTrajectory[0].risk)} pts`} tone="blue" />
        <KPI label="Fleet risk (2029)" value={`${fmt(fleetTrajectory[fleetTrajectory.length - 1].risk)} pts`} tone="blue" />
        <KPI
          label="Risk retired (2025→2029)"
          value={`${fmt(fleetTrajectory[0].risk - fleetTrajectory[fleetTrajectory.length - 1].risk)} pts`}
          tone="green"
        />
        <KPI
          label="TOTEX envelope (RM m/year)"
          value={`RM ${fmt(scenarioParams[scenario].totexRMmPerYear)}m`}
          tone="amber"
        />
      </div>

      {/* Trajectory + Asset class view */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Fleet risk trajectory */}
        <Card
          title="Fleet risk trajectory (2025–2029)"
          subtitle="Portfolio-level view (no asset selection). Use for strategic funding and risk appetite discussions."
        >
          <div className="space-y-3">
            {fleetTrajectory.map((d) => {
              const pct = (d.risk / maxRisk) * 100;
              return (
                <div key={d.year} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-[var(--seb-navy)]">{d.year}</span>
                    <span className="text-gray-700">{fmt(d.risk)} pts</span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[var(--seb-blue)]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-lg bg-gray-50 p-4 text-xs text-gray-600">
            {pill("Risk = 0–100 index aggregated", "gray")} {pill("Scenario = portfolio assumptions", "gray")}
          </div>
        </Card>

        {/* Expected loss trajectory */}
        <Card
          title="Expected loss proxy (RM m/year)"
          subtitle="Illustrative translation of risk points into monetary exposure (executive-friendly)."
        >
          <div className="space-y-3">
            {lossTrajectory.map((d) => {
              const pct = (d.expectedLossRMm / maxLoss) * 100;
              return (
                <div key={d.year} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-[var(--seb-navy)]">{d.year}</span>
                    <span className="text-gray-700">RM {fmt(d.expectedLossRMm, 1)}m</span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[var(--seb-green)]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-lg bg-gray-50 p-4 text-xs text-gray-600 space-y-1">
            <div>{pill(`Conversion: RM ${scenarioParams[scenario].rmPerRiskPoint}m per risk point`, "gray")}</div>
            <div className="text-[11px] text-gray-500">
              Demo note: production uses SEB outage cost + consequence model to monetize risk.
            </div>
          </div>
        </Card>

        {/* Concentration & narrative */}
        <Card title="Risk concentration & planning signals" subtitle="Executive signals to guide funding and risk appetite.">
          <div className="space-y-4">
            <div className="rounded-lg border p-4">
              <div className="text-xs text-gray-500">Fleet risk concentration</div>
              <div className="mt-1 text-sm text-gray-700">
                Top <span className="font-medium">{concentration.top10pctCount}</span> assets account for{" "}
                <span className="font-semibold text-[var(--seb-navy)]">{concentration.pctTop10}%</span> of total risk.
              </div>
              <div className="mt-2 text-xs text-gray-500">
                Use: decide whether to fund targeted “top-risk” programs vs broad condition-based renewals.
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <div className="text-xs text-gray-500">High-risk inventory</div>
              <div className="mt-1 text-sm text-gray-700">
                High-risk assets (≥70): <span className="font-semibold text-[var(--seb-navy)]">{concentration.highRisk}</span>
              </div>
              <div className="mt-2 text-xs text-gray-500">Use: set a multi-year target to reduce high-risk count.</div>
            </div>

            <div className="rounded-lg bg-gray-50 p-4 text-xs text-gray-600 space-y-2">
              <div className="font-medium text-[var(--seb-navy)]">Scope guardrails (avoids Maximo overlap)</div>
              <ul className="list-disc pl-5 space-y-1">
                {scopeNote.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      </div>

      {/* Risk by asset class: 2025 vs 2029 */}
      <Card
        title="Risk by asset class (2025 vs 2029)"
        subtitle="Shows how the scenario shifts structural risk across asset classes (portfolio view)."
      >
        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-lg border p-4">
            <div className="font-medium text-[var(--seb-navy)]">2025 baseline</div>
            <div className="mt-3 space-y-2">
              {classTrajectory[y0].slice(0, 10).map((r) => (
                <div key={r.assetClass} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{r.assetClass}</span>
                  <span className="font-medium text-[var(--seb-navy)]">{fmt(r.risk)} pts</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="font-medium text-[var(--seb-navy)]">2029 projection ({selectedScenario.label})</div>
            <div className="mt-3 space-y-2">
              {classTrajectory[yN].slice(0, 10).map((r) => (
                <div key={r.assetClass} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{r.assetClass}</span>
                  <span className="font-medium text-[var(--seb-navy)]">{fmt(r.risk)} pts</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="text-xs text-gray-500">
          Demo note: Production would support filtering, drill-down by region, and driver decomposition (health vs consequence contributors).
        </div>
      </Card>

      {/* Scenario comparison (side-by-side) */}
      <Card title="Scenario comparison (side-by-side)" subtitle="Portfolio outcomes (2025 baseline → 2029 projection) with RM lens.">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="p-3">Scenario</th>
                <th className="p-3">Fleet Risk 2029 (pts)</th>
                <th className="p-3">Risk Retired (%)</th>
                <th className="p-3">TOTEX (RM m/year)</th>
                <th className="p-3">TOTEX 5y (RM m)</th>
                <th className="p-3">CAPEX 5y (RM m)</th>
                <th className="p-3">OPEX 5y (RM m)</th>
                <th className="p-3">Expected Loss 5y (RM m)</th>
                <th className="p-3">Avoided Loss vs Constrained (RM m)</th>
              </tr>
            </thead>
            <tbody>
              {scenarioComparison.map((r) => {
                const highlight = r.key === scenario ? "bg-blue-50" : "";
                const avoided = Math.max(0, constrainedLoss - r.expectedLoss5y);
                return (
                  <tr key={r.key} className={`border-t ${highlight}`}>
                    <td className="p-3 font-medium text-[var(--seb-navy)]">
                      {r.label} {r.key === scenario ? pill("Selected", "blue") : null}
                    </td>
                    <td className="p-3 font-semibold text-[var(--seb-navy)]">{fmt(r.end)} pts</td>
                    <td className="p-3">{r.retiredPct.toFixed(1)}%</td>
                    <td className="p-3">RM {fmt(r.totexPerYear)}m</td>
                    <td className="p-3">RM {fmt(r.totex5y)}m</td>
                    <td className="p-3">RM {fmt(r.capex5y)}m</td>
                    <td className="p-3">RM {fmt(r.opex5y)}m</td>
                    <td className="p-3">RM {fmt(r.expectedLoss5y, 1)}m</td>
                    <td className="p-3 font-semibold text-[var(--seb-green)]">RM {fmt(avoided, 1)}m</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg bg-gray-50 p-4 text-xs text-gray-600">
          <div className="font-medium text-[var(--seb-navy)] mb-1">Notes (demo)</div>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              “Expected Loss 5y” is a proxy: fleet risk points × RM per risk point (scenario-independent conversion).
            </li>
            <li>
              “Avoided loss” compares expected loss vs the constrained scenario (illustrative planning signal, not an NPV).
            </li>
            <li>
              TOTEX here is a strategic envelope (RM m/year) and does not duplicate annual intervention selection.
            </li>
          </ul>
        </div>
      </Card>

      {/* Methodology footer */}
      <div className="rounded-xl border bg-white shadow-sm p-6 text-xs text-gray-600">
        <div className="font-semibold text-[var(--seb-navy)] mb-2">How to interpret the RM lens (demo)</div>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            Fleet risk points are converted into RM exposure using a simple coefficient to support executive discussions.
          </li>
          <li>
            Production approach: monetize risk using SEB’s outage consequence model (SAIDI/SAIFI, customer class, critical loads) + asset failure costs.
          </li>
          <li>
            This page supports multi-year trade-offs; the annual plan remains in “Capital Optimization – Annual Plan”.
          </li>
        </ul>
      </div>
    </div>
  );
}