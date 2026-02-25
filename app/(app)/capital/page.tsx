"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { assets } from "@/lib/mock";
import { type Horizon, expectedExposureRMm, interventionOptions, type InterventionOption } from "@/lib/analytics";

type SortMode = "DELTA_PER_RM" | "DELTA_ABS";

function KPI({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl bg-white border shadow-sm p-6">
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
      <div className={`mt-2 text-2xl font-semibold ${highlight ? "text-[var(--seb-green)]" : "text-[var(--seb-navy)]"}`}>
        {value}
      </div>
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

function fmtRMm(n: number) {
  return new Intl.NumberFormat("en-MY", { maximumFractionDigits: 1 }).format(n);
}

type EnrichedOption = InterventionOption & {
  exposureBeforeRMm: number;
  exposureAfterRMm: number;
  deltaExposureRMm: number;
  efficiency: number; // delta per RM
};

export default function CapitalPage() {
  // Budgets are separate, as in real utilities
  const [capexBudget, setCapexBudget] = useState<number>(80); // RM m
  const [opexBudget, setOpexBudget] = useState<number>(25); // RM m

  // Annual planning horizon (what annual plan optimizes on)
  const [horizon, setHorizon] = useState<Horizon>("12m");
  const [sortMode, setSortMode] = useState<SortMode>("DELTA_PER_RM");

  // Build options from predictive outputs
  const allOptions = useMemo<EnrichedOption[]>(() => {
    return assets.flatMap((a) => {
      const base = expectedExposureRMm(a, horizon);

      return interventionOptions(a).map((opt) => {
        const after = Number((base * opt.pofMultiplier).toFixed(1));
        const delta = Number((base - after).toFixed(1));
        const eff = delta / Math.max(0.1, opt.costRMm);

        return {
          ...opt,
          exposureBeforeRMm: base,
          exposureAfterRMm: after,
          deltaExposureRMm: delta,
          efficiency: Number(eff.toFixed(3)),
        };
      });
    });
  }, [horizon]);

  // Optimizer (simple heuristic, demo-friendly, one option per asset)
  const optimized = useMemo(() => {
    let capexLeft = capexBudget;
    let opexLeft = opexBudget;

    const chosen: EnrichedOption[] = [];
    const picked = new Set<string>();

    const ranked = [...allOptions].sort((a, b) => {
      if (sortMode === "DELTA_ABS") return b.deltaExposureRMm - a.deltaExposureRMm;
      return b.efficiency - a.efficiency;
    });

    for (const opt of ranked) {
      if (picked.has(opt.assetId)) continue;
      if (opt.deltaExposureRMm <= 0) continue;

      if (opt.type === "CAPEX") {
        if (opt.costRMm <= capexLeft) {
          chosen.push(opt);
          capexLeft -= opt.costRMm;
          picked.add(opt.assetId);
        }
      } else {
        if (opt.costRMm <= opexLeft) {
          chosen.push(opt);
          opexLeft -= opt.costRMm;
          picked.add(opt.assetId);
        }
      }
    }

    // Executive sort: most impact first
    chosen.sort((a, b) => b.deltaExposureRMm - a.deltaExposureRMm);

    return {
      chosen,
      capexLeft: Number(capexLeft.toFixed(1)),
      opexLeft: Number(opexLeft.toFixed(1)),
    };
  }, [allOptions, capexBudget, opexBudget, sortMode]);

  const exposureBeforeFleet = useMemo(() => {
    return Number(assets.reduce((s, a) => s + expectedExposureRMm(a, horizon), 0).toFixed(1));
  }, [horizon]);

  const exposureReduction = useMemo(() => {
    return Number(optimized.chosen.reduce((s, o) => s + o.deltaExposureRMm, 0).toFixed(1));
  }, [optimized.chosen]);

  const exposureAfterFleet = useMemo(() => {
    return Number(Math.max(0, exposureBeforeFleet - exposureReduction).toFixed(1));
  }, [exposureBeforeFleet, exposureReduction]);

  const capexUsed = useMemo(() => {
    return Number(optimized.chosen.filter((o) => o.type === "CAPEX").reduce((s, o) => s + o.costRMm, 0).toFixed(1));
  }, [optimized.chosen]);

  const opexUsed = useMemo(() => {
    return Number(optimized.chosen.filter((o) => o.type === "OPEX").reduce((s, o) => s + o.costRMm, 0).toFixed(1));
  }, [optimized.chosen]);

  const reductionPct = useMemo(() => {
    return exposureBeforeFleet > 0 ? Number(((exposureReduction / exposureBeforeFleet) * 100).toFixed(1)) : 0;
  }, [exposureBeforeFleet, exposureReduction]);

  const classAllocation = useMemo(() => {
    const map: Record<string, { capex: number; opex: number; delta: number }> = {};
    for (const o of optimized.chosen) {
      if (!map[o.assetClass]) map[o.assetClass] = { capex: 0, opex: 0, delta: 0 };
      if (o.type === "CAPEX") map[o.assetClass].capex += o.costRMm;
      else map[o.assetClass].opex += o.costRMm;
      map[o.assetClass].delta += o.deltaExposureRMm;
    }
    return Object.entries(map)
      .map(([assetClass, v]) => ({
        assetClass,
        capex: Number(v.capex.toFixed(1)),
        opex: Number(v.opex.toFixed(1)),
        delta: Number(v.delta.toFixed(1)),
      }))
      .sort((a, b) => b.delta - a.delta);
  }, [optimized.chosen]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--seb-navy)]">Capital Optimization – Annual Plan</h1>
          <p className="text-sm text-gray-600">
            Annual portfolio recommendation using predictive <span className="font-medium">expected exposure (RM m)</span>.
            Execution stays in Maximo.
          </p>
        </div>

        <Link href="/planning" className="text-sm underline text-[var(--seb-blue)]">
          5-Year Strategic Asset Plan
        </Link>
      </div>

      {/* Controls */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="rounded-xl bg-white border shadow-sm p-6 space-y-3">
          <div className="font-semibold text-[var(--seb-navy)]">Planning horizon</div>
          <div className="inline-flex rounded-xl border bg-gray-50 p-1">
            {(["3m", "6m", "12m", "24m"] as Horizon[]).map((h) => {
              const active = h === horizon;
              return (
                <button
                  key={h}
                  onClick={() => setHorizon(h)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    active ? "bg-white shadow-sm text-[var(--seb-navy)]" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {h}
                </button>
              );
            })}
          </div>
          <div className="text-xs text-gray-500">
            Uses predictive exposure baseline from PoF: <span className="font-medium">Exposure = PoF% × consequence proxy</span>.
          </div>
        </div>

        <div className="rounded-xl bg-white border shadow-sm p-6 space-y-3">
          <div className="font-semibold text-[var(--seb-navy)]">Optimization objective</div>
          <div className="flex gap-2">
            <button
              onClick={() => setSortMode("DELTA_PER_RM")}
              className={`px-3 py-2 rounded-lg text-sm border ${
                sortMode === "DELTA_PER_RM" ? "bg-blue-50 border-blue-200 text-[var(--seb-navy)]" : "bg-white"
              }`}
            >
              Max Δ exposure / RM
            </button>
            <button
              onClick={() => setSortMode("DELTA_ABS")}
              className={`px-3 py-2 rounded-lg text-sm border ${
                sortMode === "DELTA_ABS" ? "bg-blue-50 border-blue-200 text-[var(--seb-navy)]" : "bg-white"
              }`}
            >
              Max Δ exposure
            </button>
          </div>
          <div className="text-xs text-gray-500">
            Demo heuristic: ranks options, then selects under CAPEX/OPEX envelopes (one option per asset).
          </div>
        </div>

        <div className="rounded-xl bg-white border shadow-sm p-6 space-y-3">
          <div className="font-semibold text-[var(--seb-navy)]">Why this doesn’t overlap with Maximo</div>
          <div className="text-xs text-gray-600 space-y-1">
            <div>• Outputs a recommended annual portfolio</div>
            <div>• Does not create work orders</div>
            <div>• Export-ready for governance / Maximo execution</div>
          </div>
        </div>
      </div>

      {/* Budgets */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-xl bg-white border shadow-sm p-6 space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-medium text-[var(--seb-navy)]">CAPEX budget</div>
            <div className="font-semibold text-[var(--seb-navy)]">RM {capexBudget}m</div>
          </div>
          <input
            type="range"
            min={10}
            max={300}
            step={5}
            value={capexBudget}
            onChange={(e) => setCapexBudget(Number(e.target.value))}
            className="w-full"
          />
          <div className="text-xs text-gray-500">
            Used: <span className="font-medium text-gray-700">RM {capexUsed}m</span> · Remaining:{" "}
            <span className="font-medium text-gray-700">RM {optimized.capexLeft}m</span>
          </div>
        </div>

        <div className="rounded-xl bg-white border shadow-sm p-6 space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-medium text-[var(--seb-navy)]">OPEX budget</div>
            <div className="font-semibold text-[var(--seb-navy)]">RM {opexBudget}m</div>
          </div>
          <input
            type="range"
            min={5}
            max={120}
            step={1}
            value={opexBudget}
            onChange={(e) => setOpexBudget(Number(e.target.value))}
            className="w-full"
          />
          <div className="text-xs text-gray-500">
            Used: <span className="font-medium text-gray-700">RM {opexUsed}m</span> · Remaining:{" "}
            <span className="font-medium text-gray-700">RM {optimized.opexLeft}m</span>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid md:grid-cols-4 gap-6">
        <KPI label={`Fleet exposure (current, ${horizon})`} value={`RM ${fmtRMm(exposureBeforeFleet)}m`} />
        <KPI label="Fleet exposure (post-plan)" value={`RM ${fmtRMm(exposureAfterFleet)}m`} />
        <KPI label="Exposure reduction" value={`${reductionPct}%`} highlight />
        <KPI label="Interventions selected" value={`${optimized.chosen.length}`} />
      </div>

      {/* Allocation + Portfolio */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Allocation */}
        <div className="lg:col-span-1 rounded-xl bg-white border shadow-sm p-6">
          <div className="font-semibold text-[var(--seb-navy)]">Allocation by asset class</div>
          <div className="mt-3 space-y-3">
            {classAllocation.length === 0 && (
              <div className="text-sm text-gray-500">No interventions selected under current budgets.</div>
            )}

            {classAllocation.map((r) => (
              <div key={r.assetClass} className="rounded-lg border p-3">
                <div className="font-medium text-sm text-[var(--seb-navy)]">{r.assetClass}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {r.capex > 0 ? pill(`CAPEX RM ${fmtRMm(r.capex)}m`, "blue") : null}
                  {r.opex > 0 ? pill(`OPEX RM ${fmtRMm(r.opex)}m`, "green") : null}
                  {pill(`Δ Exp RM ${fmtRMm(r.delta)}m`, "gray")}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 text-xs text-gray-500">
            Demo note: this is a planning recommendation layer; execution is managed in Maximo.
          </div>
        </div>

        {/* Portfolio table */}
        <div className="lg:col-span-2 rounded-xl bg-white border shadow-sm overflow-hidden">
          <div className="p-6 border-b">
            <div className="font-semibold text-[var(--seb-navy)]">Optimized intervention portfolio</div>
            <div className="text-xs text-gray-500 mt-1">
              Uses predictive exposure baseline from PoF to compute “Exposure Before/After” and optimize under CAPEX/OPEX envelopes.
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="p-3">Asset</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Class</th>
                  <th className="p-3">Region</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Lead time</th>
                  <th className="p-3">Cost (RM m)</th>
                  <th className="p-3">Exposure Before</th>
                  <th className="p-3">Exposure After</th>
                  <th className="p-3">Δ Exposure</th>
                </tr>
              </thead>
              <tbody>
                {optimized.chosen.map((o) => (
                  <tr key={`${o.assetId}-${o.type}`} className="border-t hover:bg-gray-50">
                    <td className="p-3 font-medium">{o.assetId}</td>
                    <td className="p-3">{o.type === "CAPEX" ? pill("CAPEX", "blue") : pill("OPEX", "green")}</td>
                    <td className="p-3">{o.assetClass}</td>
                    <td className="p-3">{o.region}</td>
                    <td className="p-3">{o.action}</td>
                    <td className="p-3">{o.leadTimeMonths} mo</td>
                    <td className="p-3">{fmtRMm(o.costRMm)}</td>
                    <td className="p-3">RM {fmtRMm(o.exposureBeforeRMm)}m</td>
                    <td className="p-3">RM {fmtRMm(o.exposureAfterRMm)}m</td>
                    <td className="p-3 font-semibold text-[var(--seb-navy)]">RM {fmtRMm(o.deltaExposureRMm)}m</td>
                  </tr>
                ))}

                {optimized.chosen.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-10 text-center text-gray-500">
                      No interventions selected. Increase budgets or change objective.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t text-xs text-gray-500">
            Next (roadmap): add constraints (outage windows, lead times, SAIDI/SAIFI targets) and allow multi-year optimization (2026–2030).
          </div>
        </div>
      </div>
    </div>
  );
}