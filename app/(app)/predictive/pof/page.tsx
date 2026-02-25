"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { assets } from "@/lib/mock";

type Horizon = "30d" | "1y" | "3y";

type Row = {
  id: string;
  name: string;
  assetClass: string;
  region: string;

  health: number; // 0–100
  criticality: number; // 0–100
  risk: number; // 0–100

  pofPct: number; // 0–100 (%)
  expectedExposureRMm: number; // RM million (proxy)
  dominantMode: string;
};

function pill(text: string, tone: "blue" | "green" | "amber" | "red" | "gray") {
  const cls =
    tone === "green"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : tone === "red"
      ? "border-red-200 bg-red-50 text-red-800"
      : tone === "blue"
      ? "border-blue-200 bg-blue-50 text-blue-800"
      : "border-gray-200 bg-gray-50 text-gray-700";
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${cls}`}>{text}</span>;
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-MY", { maximumFractionDigits: 1 }).format(n);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// Horizon sensitivity: short horizon emphasizes current condition / anomalies,
// longer horizon emphasizes structural risk (ageing proxy, criticality, base risk).
function horizonWeights(h: Horizon) {
  if (h === "30d") return { wHealth: 0.65, wRisk: 0.20, wCrit: 0.15 };
  if (h === "1y") return { wHealth: 0.45, wRisk: 0.30, wCrit: 0.25 };
  return { wHealth: 0.30, wRisk: 0.35, wCrit: 0.35 }; // 3y
}

function baseFailureCostRMm(assetClass: string, criticality: number) {
  // rough demo cost envelope in RMm
  const base =
    assetClass.includes("Power Transformer") ? 18 :
    assetClass.includes("Distribution Transformer") ? 4 :
    assetClass.includes("Switchgear") ? 8 :
    assetClass.includes("Circuit Breaker") ? 3 :
    assetClass.includes("Overhead Line") ? 2.5 :
    assetClass.includes("Underground Cable") ? 6 :
    assetClass.includes("Substation") ? 12 :
    assetClass.includes("Protection") ? 1.5 :
    assetClass.includes("Vegetation") ? 1 :
    5;

  // criticality scales consequence
  const scale = 0.7 + (criticality / 100) * 0.9; // 0.7–1.6
  return Number((base * scale).toFixed(1));
}

function dominantMode(assetClass: string, seed: number) {
  const modes =
    assetClass.includes("Power Transformer")
      ? ["Bushing failure", "OLTC wear", "Insulation ageing", "Cooling system"]
      : assetClass.includes("Distribution Transformer")
      ? ["Thermal ageing", "Oil degradation", "Connection failure"]
      : assetClass.includes("Switchgear")
      ? ["Partial discharge", "SF6 leakage", "Contact overheating"]
      : assetClass.includes("Circuit Breaker")
      ? ["Mechanism wear", "Timing drift", "Coil failure"]
      : assetClass.includes("Overhead Line")
      ? ["Conductor hotspots", "Insulator flashover", "Corrosion"]
      : assetClass.includes("Underground Cable")
      ? ["Joint failure", "Water treeing", "Thermal overload"]
      : assetClass.includes("Substation")
      ? ["Aux system failure", "Major defect", "Protection issue"]
      : assetClass.includes("Protection")
      ? ["Relay mis-op", "Obsolescence", "Test failure"]
      : assetClass.includes("Vegetation")
      ? ["ROW encroachment", "Storm exposure", "Growth cycle"]
      : ["General failure mode"];

  return modes[seed % modes.length];
}

function pofPctIndex(a: { health: number; risk: number; criticality: number }, h: Horizon) {
  // Convert health/risk/criticality into a PoF% proxy.
  // Health: lower health increases PoF, Risk & Crit add persistent uplift.
  const { wHealth, wRisk, wCrit } = horizonWeights(h);

  const healthBad = 100 - a.health; // higher = worse
  const raw =
    wHealth * healthBad +
    wRisk * a.risk +
    wCrit * a.criticality;

  // Horizon scaling: 30d smaller absolute PoF, 3y larger
  const scale = h === "30d" ? 0.22 : h === "1y" ? 0.38 : 0.55;

  return clamp(Math.round(raw * scale), 1, 95);
}

export default function PofPage() {
  const [horizon, setHorizon] = useState<Horizon>("1y");

  const rows = useMemo<Row[]>(() => {
    return assets.map((a) => {
      const pof = pofPctIndex({ health: a.health, risk: a.risk, criticality: a.criticality }, horizon);
      const cost = baseFailureCostRMm(a.assetClass, a.criticality);

      // Expected exposure = PoF% * Cost (proxy)
      const exposure = Number(((pof / 100) * cost).toFixed(2));

      return {
        id: a.id,
        name: a.name,
        assetClass: a.assetClass,
        region: a.region,
        health: a.health,
        criticality: a.criticality,
        risk: a.risk,
        pofPct: pof,
        expectedExposureRMm: exposure,
        dominantMode: dominantMode(a.assetClass, a.risk + a.health + a.criticality),
      };
    });
    // IMPORTANT: include horizon in memo dependency by using it inside map
  }, [horizon]);

  // Rank by expected exposure (makes ranking differ as PoF changes by horizon)
  const ranked = useMemo(() => {
    return [...rows].sort((a, b) => b.expectedExposureRMm - a.expectedExposureRMm);
  }, [rows]);

  const top10 = useMemo(() => ranked.slice(0, 10), [ranked]);

  const kpis = useMemo(() => {
    const avgPof = rows.length ? rows.reduce((s, r) => s + r.pofPct, 0) / rows.length : 0;
    const totalExposure = rows.reduce((s, r) => s + r.expectedExposureRMm, 0);
    const highPof = rows.filter((r) => r.pofPct >= 30).length; // arbitrary demo threshold
    return {
      avgPof: Number(avgPof.toFixed(1)),
      totalExposure: Number(totalExposure.toFixed(1)),
      highPof,
    };
  }, [rows]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--seb-navy)]">Probability of Failure Forecast (Phase 2+)</h1>
          <p className="text-sm text-gray-600">
            PoF shown as a <span className="font-medium">probability proxy (%)</span> by horizon (demo). Ranking uses{" "}
            <span className="font-medium">Expected Exposure (RMm)</span> to reflect consequence.
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link className="underline text-[var(--seb-blue)]" href="/predictive">
            Predictive Hub
          </Link>
          <Link className="underline text-[var(--seb-blue)]" href="/capital">
            Capital Optimization – Annual Plan
          </Link>
        </div>
      </div>

      {/* Horizon selector */}
      <div className="rounded-xl bg-white border shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="font-semibold text-[var(--seb-navy)]">Horizon</div>
            <div className="text-xs text-gray-500 mt-1">
              Short horizon emphasizes current condition; longer horizon emphasizes structural risk.
            </div>
          </div>

          <div className="inline-flex rounded-xl border bg-gray-50 p-1">
            {(["30d", "1y", "3y"] as Horizon[]).map((h) => {
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
        </div>
      </div>

      {/* KPIs */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="rounded-xl bg-white border shadow-sm p-6">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Avg PoF (selected horizon)</div>
          <div className="mt-2 text-2xl font-semibold text-[var(--seb-navy)]">{kpis.avgPof}%</div>
        </div>
        <div className="rounded-xl bg-white border shadow-sm p-6">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Total expected exposure</div>
          <div className="mt-2 text-2xl font-semibold text-[var(--seb-navy)]">RM {fmt(kpis.totalExposure)}m</div>
        </div>
        <div className="rounded-xl bg-white border shadow-sm p-6">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Assets with PoF ≥ 30%</div>
          <div className="mt-2 text-2xl font-semibold text-[var(--seb-navy)]">{kpis.highPof}</div>
        </div>
      </div>

      {/* Top 10 table */}
      <div className="rounded-xl bg-white border shadow-sm overflow-hidden">
        <div className="p-6 border-b">
          <div className="font-semibold text-[var(--seb-navy)]">Top 10 (ranked by Expected Exposure)</div>
          <div className="text-xs text-gray-500 mt-1">
            Hover on values for context; click asset ID to drill down.
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="p-3">Asset</th>
                <th className="p-3">Class</th>
                <th className="p-3">Region</th>
                <th className="p-3">PoF (%)</th>
                <th className="p-3">Failure cost (RMm)</th>
                <th className="p-3">Expected exposure (RMm)</th>
                <th className="p-3">Dominant mode</th>
              </tr>
            </thead>
            <tbody>
              {top10.map((r) => {
                const cost = baseFailureCostRMm(r.assetClass, r.criticality);
                const sev = r.pofPct >= 45 ? "High" : r.pofPct >= 25 ? "Medium" : "Low";
                return (
                  <tr key={r.id} className="border-t hover:bg-gray-50">
                    <td className="p-3 font-medium">
                      <Link className="underline" href={`/assets/item/${r.id}`}>
                        {r.id}
                      </Link>
                      <div className="text-xs text-gray-500">{r.name}</div>
                    </td>
                    <td className="p-3">{r.assetClass}</td>
                    <td className="p-3">{r.region}</td>
                    <td className="p-3 font-semibold text-[var(--seb-navy)]" title="Demo PoF proxy (%)">
                      {r.pofPct}%{" "}
                      {sev === "High" ? pill("High", "red") : sev === "Medium" ? pill("Medium", "amber") : pill("Low", "green")}
                    </td>
                    <td className="p-3" title="Cost proxy for consequence of failure">
                      RM {fmt(cost)}m
                    </td>
                    <td className="p-3 font-semibold text-[var(--seb-navy)]" title="PoF% × failure cost (proxy)">
                      RM {fmt(r.expectedExposureRMm)}m
                    </td>
                    <td className="p-3">{r.dominantMode}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t text-xs text-gray-500">
          Demo boundary: PoF feeds prioritization + program packs; execution remains in Maximo.
        </div>
      </div>

      {/* Method note */}
      <div className="rounded-xl border bg-white shadow-sm p-6 text-xs text-gray-600">
        <div className="font-semibold text-[var(--seb-navy)] mb-2">Methodology notes (demo)</div>
        <ul className="list-disc pl-5 space-y-1">
          <li>PoF is a proxy based on health/risk/criticality and horizon sensitivity (not a calibrated statistical model yet).</li>
          <li>Expected exposure uses a simple consequence proxy (RMm) × PoF% to shift rankings by horizon.</li>
          <li>In production, PoF models are trained/calibrated on SEB fleet failure history and validated with engineers.</li>
        </ul>
      </div>
    </div>
  );
}