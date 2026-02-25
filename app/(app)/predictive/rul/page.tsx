"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { assets } from "@/lib/mock";

type RulRow = {
  id: string;
  name: string;
  assetClass: string;
  region: string;

  risk: number; // 0–100
  health: number; // 0–100
  criticality: number; // 0–100

  p50Years: number;
  p90Years: number;
  driver: string;
  decision: "Monitor" | "Repair" | "Replace";
  bucket: "0–2y" | "2–5y" | "5–10y" | "10y+";
};

type Bucket = RulRow["bucket"];
type Decision = RulRow["decision"];

function pill(text: string, tone: "green" | "blue" | "amber" | "red" | "gray") {
  const cls =
    tone === "green"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "blue"
      ? "border-blue-200 bg-blue-50 text-blue-800"
      : tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : tone === "red"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-gray-200 bg-gray-50 text-gray-700";
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${cls}`}>{text}</span>;
}

function drivers(assetClass: string) {
  if (assetClass.includes("Power Transformer")) return ["Insulation ageing", "DGA trend", "Moisture ingress", "Bushing condition"];
  if (assetClass.includes("Distribution Transformer")) return ["Loading stress", "Oil quality", "Thermal ageing"];
  if (assetClass.includes("Switchgear")) return ["Partial discharge", "SF6 quality", "Contact wear"];
  if (assetClass.includes("Circuit Breaker")) return ["Operations count", "Mechanism wear", "Timing drift"];
  if (assetClass.includes("Overhead Line")) return ["Corrosion", "Hotspots", "Insulator condition"];
  if (assetClass.includes("Underground Cable")) return ["Joint condition", "Thermal margin", "Water treeing"];
  if (assetClass.includes("Substation")) return ["Aux systems", "Major defects", "Environmental exposure"];
  if (assetClass.includes("Protection")) return ["Obsolescence", "Test results", "Governance maturity"];
  if (assetClass.includes("Vegetation")) return ["ROW encroachment", "Seasonality", "Storm exposure"];
  return ["General deterioration"];
}

function bucket(y: number): Bucket {
  if (y <= 2) return "0–2y";
  if (y <= 5) return "2–5y";
  if (y <= 10) return "5–10y";
  return "10y+";
}

function buildRows(): RulRow[] {
  return assets.map((a) => {
    // Demo proxy: higher health -> longer RUL; higher risk -> shorter RUL
    const base = Math.max(0.6, (a.health / 100) * 14); // up to ~14y
    const penalty = (a.risk / 100) * 6; // subtract up to ~6y
    const p50 = Math.max(0.5, Number((base - penalty).toFixed(1)));
    const p90 = Math.max(0.3, Number((p50 * 0.65).toFixed(1)));

    const d = drivers(a.assetClass);
    const driver = d[(a.risk + a.health + a.criticality) % d.length];

    const decision: Decision = a.risk >= 75 || p50 <= 2 ? "Replace" : a.risk >= 55 || p50 <= 5 ? "Repair" : "Monitor";

    return {
      id: a.id,
      name: a.name,
      assetClass: a.assetClass,
      region: a.region,
      risk: a.risk,
      health: a.health,
      criticality: a.criticality,
      p50Years: p50,
      p90Years: p90,
      driver,
      decision,
      bucket: bucket(p50),
    };
  });
}

export default function RulPage() {
  const rows = useMemo(() => buildRows(), []);

  const assetClasses = useMemo(() => ["All", ...Array.from(new Set(rows.map((r) => r.assetClass))).sort()], [rows]);
  const regions = useMemo(() => ["All", ...Array.from(new Set(rows.map((r) => r.region))).sort()], [rows]);

  const [bucketFilter, setBucketFilter] = useState<Bucket | "All">("All");
  const [classFilter, setClassFilter] = useState<string>("All");
  const [regionFilter, setRegionFilter] = useState<string>("All");

  const counts = useMemo(() => {
    const c: Record<Bucket, number> = { "0–2y": 0, "2–5y": 0, "5–10y": 0, "10y+": 0 };
    rows.forEach((r) => (c[r.bucket] += 1));
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    return rows
      .filter((r) => (bucketFilter === "All" ? true : r.bucket === bucketFilter))
      .filter((r) => (classFilter === "All" ? true : r.assetClass === classFilter))
      .filter((r) => (regionFilter === "All" ? true : r.region === regionFilter))
      .sort((a, b) => a.p50Years - b.p50Years);
  }, [rows, bucketFilter, classFilter, regionFilter]);

  const waveTable = useMemo(() => {
    // Cohort planning: counts by bucket and class
    const buckets: Bucket[] = ["0–2y", "2–5y", "5–10y", "10y+"];

    const classKeys = Array.from(new Set(rows.map((r) => r.assetClass))).sort();
    const byClass: Record<string, Record<Bucket, number>> = {};
    classKeys.forEach((c) => (byClass[c] = { "0–2y": 0, "2–5y": 0, "5–10y": 0, "10y+": 0 }));

    rows.forEach((r) => {
      byClass[r.assetClass][r.bucket] += 1;
    });

    // Create rows with totals, sort by near-term (0–2y then 2–5y)
    const out = classKeys
      .map((c) => ({
        assetClass: c,
        ...byClass[c],
        total: buckets.reduce((s, b) => s + byClass[c][b], 0),
      }))
      .sort((a, b) => (b["0–2y"] - a["0–2y"]) || (b["2–5y"] - a["2–5y"]) || (b.total - a.total));

    return out;
  }, [rows]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--seb-navy)]">RUL & EoL Planning (Phase 2+)</h1>
          <p className="text-sm text-gray-600">
            Remaining Useful Life shown as <span className="font-medium">P50 / P90 years</span> (demo proxy), with key driver and decision cue.
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link className="underline text-[var(--seb-blue)]" href="/predictive">
            Predictive Hub
          </Link>
          <Link className="underline text-[var(--seb-blue)]" href="/planning">
            5-Year Strategic Asset Plan
          </Link>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid md:grid-cols-4 gap-5">
        {(["0–2y", "2–5y", "5–10y", "10y+"] as Bucket[]).map((b) => (
          <div key={b} className="rounded-xl bg-white border shadow-sm p-5">
            <div className="text-xs text-gray-500 uppercase tracking-wide">{b}</div>
            <div className="mt-1 text-2xl font-semibold text-[var(--seb-navy)]">{counts[b]}</div>
          </div>
        ))}
      </div>

      {/* Cohort planning by class */}
      <div className="rounded-xl bg-white border shadow-sm overflow-hidden">
        <div className="p-6 border-b">
          <div className="font-semibold text-[var(--seb-navy)]">Replacement wave view (by asset class)</div>
          <div className="text-xs text-gray-500 mt-1">Helps shape 2–5 year programs without overlapping Maximo work orders.</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="p-3">Asset class</th>
                <th className="p-3">0–2y</th>
                <th className="p-3">2–5y</th>
                <th className="p-3">5–10y</th>
                <th className="p-3">10y+</th>
                <th className="p-3">Total</th>
              </tr>
            </thead>
            <tbody>
              {waveTable.map((r) => (
                <tr key={r.assetClass} className="border-t hover:bg-gray-50">
                  <td className="p-3 font-medium text-[var(--seb-navy)]">{r.assetClass}</td>
                  <td className="p-3">{r["0–2y"]}</td>
                  <td className="p-3">{r["2–5y"]}</td>
                  <td className="p-3">{r["5–10y"]}</td>
                  <td className="p-3">{r["10y+"]}</td>
                  <td className="p-3 font-semibold text-[var(--seb-navy)]">{r.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t text-xs text-gray-500">
          Demo note: Production RUL uses survival / physics-informed models with calibration and validation.
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl bg-white border shadow-sm p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="font-semibold text-[var(--seb-navy)]">Filter the RUL table</div>
            <div className="text-xs text-gray-500 mt-1">Use filters to create cohort packs by class/region and replacement wave.</div>
          </div>

          <div className="flex flex-wrap gap-3">
            <select
              value={bucketFilter}
              onChange={(e) => setBucketFilter(e.target.value as any)}
              className="rounded-lg border px-3 py-2 text-sm"
            >
              <option value="All">All waves</option>
              <option value="0–2y">0–2y</option>
              <option value="2–5y">2–5y</option>
              <option value="5–10y">5–10y</option>
              <option value="10y+">10y+</option>
            </select>

            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
            >
              {assetClasses.map((c) => (
                <option key={c} value={c}>
                  {c === "All" ? "All classes" : c}
                </option>
              ))}
            </select>

            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
            >
              {regions.map((r) => (
                <option key={r} value={r}>
                  {r === "All" ? "All regions" : r}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl bg-white border shadow-sm overflow-hidden">
        <div className="p-6 border-b">
          <div className="font-semibold text-[var(--seb-navy)]">RUL table (sorted by P50)</div>
          <div className="text-xs text-gray-500 mt-1">Cue is advisory (demo): Monitor / Repair / Replace.</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="p-3">Asset</th>
                <th className="p-3">Class</th>
                <th className="p-3">Region</th>
                <th className="p-3">P50 (y)</th>
                <th className="p-3">P90 (y)</th>
                <th className="p-3">Driver</th>
                <th className="p-3">Cue</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t hover:bg-gray-50">
                  <td className="p-3 font-medium">
                    <Link className="underline" href={`/assets/item/${r.id}`}>
                      {r.id}
                    </Link>
                    <div className="text-xs text-gray-500">{r.name}</div>
                  </td>
                  <td className="p-3">{r.assetClass}</td>
                  <td className="p-3">{r.region}</td>
                  <td className="p-3 font-semibold text-[var(--seb-navy)]">{r.p50Years}</td>
                  <td className="p-3">{r.p90Years}</td>
                  <td className="p-3">{r.driver}</td>
                  <td className="p-3">
                    {r.decision === "Replace"
                      ? pill("Replace", "red")
                      : r.decision === "Repair"
                      ? pill("Repair", "amber")
                      : pill("Monitor", "green")}
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-gray-500">
                    No assets match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t text-xs text-gray-500">
          Demo boundary: RUL planning supports cohort programs; execution stays in Maximo.
        </div>
      </div>
    </div>
  );
}