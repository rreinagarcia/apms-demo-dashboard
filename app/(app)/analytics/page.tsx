"use client";

import { assets } from "@/lib/mock";
import Link from "next/link";
import { useMemo } from "react";

function Section({ title, children }: any) {
  return (
    <div className="rounded-xl bg-white border shadow-sm p-6 space-y-4">
      <div className="font-semibold text-[var(--seb-navy)]">{title}</div>
      {children}
    </div>
  );
}

// Dot color by asset class (kept simple & readable)
function dotClass(assetClass: string) {
  if (assetClass.includes("Power Transformer")) return "bg-[var(--seb-blue)]";
  if (assetClass.includes("Distribution Transformer")) return "bg-[var(--seb-green)]";
  if (assetClass.includes("Switchgear")) return "bg-amber-500";
  if (assetClass.includes("Circuit Breaker")) return "bg-indigo-500";
  if (assetClass.includes("Overhead Line")) return "bg-cyan-600";
  if (assetClass.includes("Underground Cable")) return "bg-teal-600";
  if (assetClass.includes("Substation")) return "bg-slate-700";
  if (assetClass.includes("Protection")) return "bg-fuchsia-600";
  if (assetClass.includes("Vegetation")) return "bg-lime-600";
  return "bg-gray-500";
}

export default function AnalyticsPage() {
  const riskStats = useMemo(() => {
    const high = assets.filter((a) => a.riskBand === "High").length;
    const med = assets.filter((a) => a.riskBand === "Medium").length;
    const low = assets.filter((a) => a.riskBand === "Low").length;
    const total = assets.length;
    return { high, med, low, total };
  }, []);

  const classStats = useMemo(() => {
    const map: Record<string, number> = {};
    assets.forEach((a) => (map[a.assetClass] = (map[a.assetClass] || 0) + 1));
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, []);

  const classLegend = useMemo(() => {
    const uniq = Array.from(new Set(assets.map((a) => a.assetClass)));
    return uniq.sort();
  }, []);

  const topRisk = useMemo(
    () => [...assets].sort((a, b) => b.risk - a.risk).slice(0, 10),
    []
  );

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--seb-navy)]">Portfolio Analytics</h1>
          <p className="text-sm text-gray-600">
            Risk scores shown as a normalized <span className="font-medium">0–100 index</span>.
          </p>
        </div>
        <Link href="/assets" className="text-sm underline text-[var(--seb-blue)]">
          Back to Asset Intelligence
        </Link>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Section title="Risk Band Distribution (Risk score 0–100)">
          <div className="space-y-4">
            {[
              { label: "High (≥70)", value: riskStats.high, color: "bg-red-500" },
              { label: "Medium (45–69)", value: riskStats.med, color: "bg-amber-500" },
              { label: "Low (<45)", value: riskStats.low, color: "bg-emerald-500" },
            ].map((b) => {
              const pct = riskStats.total > 0 ? (b.value / riskStats.total) * 100 : 0;
              return (
                <div key={b.label} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{b.label}</span>
                    <span className="font-medium">{b.value}</span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${b.color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        <Section title="Asset Class Breakdown (count of assets)">
          <div className="space-y-3">
            {classStats.map(([cls, count]) => {
              const pct = assets.length > 0 ? (count / assets.length) * 100 : 0;
              return (
                <div key={cls} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{cls}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[var(--seb-blue)]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      </div>

      <Section title="Risk vs Health (Both 0–100 index)">
        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-xs text-gray-600">
          {classLegend.map((c) => (
            <div key={c} className="flex items-center gap-2">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${dotClass(c)}`} />
              <span>{c}</span>
            </div>
          ))}
        </div>

        {/* Matrix */}
        <div className="relative h-96 border rounded-lg bg-gray-50 overflow-hidden">
          {/* Quadrant backgrounds (split at 50/50) */}
          <div className="absolute inset-0">
            <div className="absolute left-0 top-0 w-1/2 h-1/2 bg-red-50" />
            <div className="absolute right-0 top-0 w-1/2 h-1/2 bg-amber-50" />
            <div className="absolute left-0 bottom-0 w-1/2 h-1/2 bg-slate-50" />
            <div className="absolute right-0 bottom-0 w-1/2 h-1/2 bg-emerald-50" />
          </div>

          {/* Crosshair lines at 50 */}
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-300" />
          <div className="absolute bottom-1/2 left-0 right-0 h-px bg-gray-300" />

          {/* Quadrant labels */}
          <div className="absolute left-3 top-3 text-xs font-medium text-red-700">
            Prioritize (High risk / Low health)
          </div>
          <div className="absolute right-3 top-3 text-xs font-medium text-amber-700 text-right">
            Monitor (High risk / High health)
          </div>
          <div className="absolute left-3 bottom-3 text-xs font-medium text-slate-700">
            Watchlist (Low risk / Low health)
          </div>
          <div className="absolute right-3 bottom-3 text-xs font-medium text-emerald-700 text-right">
            Healthy (Low risk / High health)
          </div>

          {/* Points + Custom hover tooltip */}
          {assets.map((a) => {
            const left = `${a.health}%`; // x = Health
            const bottom = `${a.risk}%`; // y = Risk

            return (
              <div key={a.id} className="absolute group" style={{ left, bottom }}>
                {/* Dot */}
                <div
                  className={`w-3 h-3 rounded-full ${dotClass(a.assetClass)} opacity-85 hover:scale-125 transition`}
                />

                {/* Tooltip */}
                <div className="absolute z-50 hidden group-hover:block -translate-x-1/2 -translate-y-full mb-3 w-64 rounded-lg border bg-white shadow-lg p-3 text-xs text-gray-700">
                  <div className="font-semibold text-[var(--seb-navy)] mb-1">{a.id}</div>
                  <div className="space-y-1">
                    <div>
                      <span className="text-gray-500">Class:</span> {a.assetClass}
                    </div>
                    <div>
                      <span className="text-gray-500">Region:</span> {a.region}
                    </div>
                    <div>
                      <span className="text-gray-500">Risk:</span> {a.risk} / 100
                    </div>
                    <div>
                      <span className="text-gray-500">Health:</span> {a.health} / 100
                    </div>
                    <div>
                      <span className="text-gray-500">Band:</span> {a.riskBand}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Axis labels */}
          <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-gray-600 px-2 pb-2">
            <span>0</span>
            <span>Health (0–100)</span>
            <span>100</span>
          </div>
          <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs text-gray-600 py-2 pl-2">
            <span>100</span>
            <span>Risk (0–100)</span>
            <span>0</span>
          </div>
        </div>
      </Section>

      <Section title="Top 10 Risk Assets (Risk score 0–100)">
        <table className="w-full text-sm">
          <thead className="text-left bg-gray-50">
            <tr>
              <th className="p-3">Asset</th>
              <th className="p-3">Class</th>
              <th className="p-3">Region</th>
              <th className="p-3">Risk (0–100)</th>
              <th className="p-3">Horizon</th>
            </tr>
          </thead>
          <tbody>
            {topRisk.map((a) => (
              <tr key={a.id} className="border-t hover:bg-gray-50">
                <td className="p-3 font-medium">
                  <Link className="underline" href={`/assets/item/${a.id}`}>
                    {a.id}
                  </Link>
                </td>
                <td className="p-3">{a.assetClass}</td>
                <td className="p-3">{a.region}</td>
                <td className="p-3 font-semibold text-[var(--seb-navy)]">{a.risk}</td>
                <td className="p-3">{a.horizon}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <div className="rounded-xl border bg-white shadow-sm p-6 text-xs text-gray-600">
        <div className="font-semibold text-[var(--seb-navy)] mb-2">Risk methodology (demo model)</div>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <span className="font-medium text-gray-800">Asset risk score (0–100 index)</span> combines health (probability proxy) and criticality (consequence proxy).
          </li>
          <li>High ≥ 70, Medium 45–69, Low &lt; 45 (illustrative thresholds).</li>
          <li>In production, weights and thresholds are calibrated using SEB failure history, outage impact, and expert validation.</li>
        </ul>
      </div>
    </div>
  );
}