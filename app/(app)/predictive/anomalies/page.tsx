"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { assets } from "@/lib/mock";

type Severity = "High" | "Medium" | "Low";

type Alert = {
  id: string;
  assetId: string;
  assetName: string;
  assetClass: string;
  region: string;

  indicatorFamily: IndicatorFamily;
  indicator: string;

  severity: Severity;
  score: number; // 0–100
  delta7d: number; // +/-
  change: string;
  recommendedNext: string;

  // “evidence” cards (demo)
  evidence: {
    title: string;
    points: string[];
  }[];

  trend: number[]; // 12 points 0–100
};

type IndicatorFamily =
  | "DGA"
  | "Partial Discharge"
  | "Thermal"
  | "Switching / Timing"
  | "Cable Joints"
  | "Protection"
  | "Vegetation"
  | "Aux Systems";

const INDICATORS: { family: IndicatorFamily; label: string; hint: string }[] = [
  { family: "DGA", label: "DGA (C2H2 / H2)", hint: "Transformer dissolved gas anomaly index" },
  { family: "Partial Discharge", label: "Partial discharge (PD)", hint: "PD trend index for GIS/cables" },
  { family: "Thermal", label: "Thermal (temp / loading)", hint: "Thermal margin & hotspot drift" },
  { family: "Switching / Timing", label: "Switching / timing drift", hint: "Breaker operations & timing drift index" },
  { family: "Cable Joints", label: "Cable joints condition", hint: "Joint temperature & PD proxy" },
  { family: "Protection", label: "Protection mis-op risk", hint: "Trips / settings / test result anomaly" },
  { family: "Vegetation", label: "Vegetation exposure", hint: "ROW encroachment and storm exposure" },
  { family: "Aux Systems", label: "Aux systems alarms", hint: "Substation auxiliaries / alarms anomaly" },
];

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
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${cls}`}>
      {text}
    </span>
  );
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function makeTrend(seed: number, family: IndicatorFamily) {
  // Make trends slightly different by family (still deterministic)
  const arr: number[] = [];
  let v = (seed % 25) + 40;

  for (let i = 0; i < 12; i++) {
    let step = ((seed * (i + 5)) % 11) - 4; // -4..+6 baseline

    // family shaping
    if (family === "DGA") step += i > 8 ? 2 : 0;
    if (family === "Partial Discharge") step += i % 5 === 0 ? 3 : 0;
    if (family === "Thermal") step += i > 6 ? 1 : 0;
    if (family === "Vegetation") step += i % 4 === 0 ? 2 : 0;

    v = clamp(v + step, 10, 95);
    arr.push(v);
  }
  return arr;
}

function familyForAsset(assetClass: string): IndicatorFamily {
  if (assetClass.includes("Power Transformer")) return "DGA";
  if (assetClass.includes("Distribution Transformer")) return "Thermal";
  if (assetClass.includes("Switchgear")) return "Partial Discharge";
  if (assetClass.includes("Circuit Breaker")) return "Switching / Timing";
  if (assetClass.includes("Overhead Line")) return "Thermal";
  if (assetClass.includes("Underground Cable")) return "Cable Joints";
  if (assetClass.includes("Substation")) return "Aux Systems";
  if (assetClass.includes("Protection")) return "Protection";
  if (assetClass.includes("Vegetation")) return "Vegetation";
  return "Thermal";
}

function indicatorLabel(family: IndicatorFamily) {
  const x = INDICATORS.find((i) => i.family === family);
  return x ? `${x.label} anomaly index (0–100)` : "Indicator anomaly index (0–100)";
}

function buildEvidence(a: (typeof assets)[number], family: IndicatorFamily, score: number) {
  const common = [
    { title: "Evidence summary", points: [`Last update: today (demo)`, `Model confidence: ${clamp(55 + (a.health % 30), 55, 90)}%`] },
  ];

  if (family === "DGA") {
    return [
      ...common,
      { title: "Recent signals", points: [`C2H2 rising vs 30-day baseline`, `H2 elevated; check for arcing / OLTC activity`, `Cross-check oil quality & moisture`] },
      { title: "Recommended verification", points: [`Trigger targeted DGA sample`, `Review bushing / OLTC condition`, `Confirm loading profile anomalies`] },
    ];
  }
  if (family === "Partial Discharge") {
    return [
      ...common,
      { title: "Recent signals", points: [`PD trend above expected envelope`, `Possible insulation tracking / surface discharge`] },
      { title: "Recommended verification", points: [`PD measurement / UHF scan`, `Visual inspection during safe window`, `Check SF6 / humidity where applicable`] },
    ];
  }
  if (family === "Thermal") {
    return [
      ...common,
      { title: "Recent signals", points: [`Hotspot drift detected`, `Thermal margin reduced under peak load`] },
      { title: "Recommended verification", points: [`IR scan / thermal patrol`, `Validate loading and ambient`, `Check cooling / fans / radiators if applicable`] },
    ];
  }
  if (family === "Switching / Timing") {
    return [
      ...common,
      { title: "Recent signals", points: [`Timing drift vs historical operations`, `Mechanism wear proxy increasing`] },
      { title: "Recommended verification", points: [`Timing test`, `Lubrication / mechanism inspection`, `Review operations count and duty`] },
    ];
  }
  if (family === "Cable Joints") {
    return [
      ...common,
      { title: "Recent signals", points: [`Joint temperature proxy rising`, `Possible water treeing / joint degradation`] },
      { title: "Recommended verification", points: [`Targeted joint inspection`, `PD test (offline/online)`, `Check sheath bonding / moisture ingress`] },
    ];
  }
  if (family === "Protection") {
    return [
      ...common,
      { title: "Recent signals", points: [`Trip pattern outlier`, `Test result drift vs baseline`] },
      { title: "Recommended verification", points: [`Settings validation`, `Secondary injection test`, `Check recent network changes / coordination`] },
    ];
  }
  if (family === "Vegetation") {
    return [
      ...common,
      { title: "Recent signals", points: [`ROW encroachment proxy rising`, `High exposure under storm scenario`] },
      { title: "Recommended verification", points: [`Priority corridor patrol`, `Lidar / drone scan where available`, `Schedule targeted trimming pack`] },
    ];
  }
  return [
    ...common,
    { title: "Recommended verification", points: [`Review alarms & logs`, `Validate with inspection / test`, `Confirm data quality and timestamps`] },
  ];
}

function buildAlerts(selectedFamily: IndicatorFamily | "All"): Alert[] {
  const base = [...assets].map((a) => {
    const family = familyForAsset(a.assetClass);
    const indicator = indicatorLabel(family);

    // demo anomaly score: pushes up with risk + low health
    const score = clamp(Math.round(a.risk * 0.8 + (100 - a.health) * 0.35), 0, 100);

    const severity: Severity = score >= 78 ? "High" : score >= 55 ? "Medium" : "Low";

    const delta7d = Math.round(((a.risk + a.criticality) % 18) - 6); // -6..+11
    const change =
      severity === "High"
        ? "Sharp upward deviation vs expected baseline (7 days)"
        : severity === "Medium"
        ? "Sustained drift above expected range (30 days)"
        : "Minor deviation; monitor";

    const recommendedNext =
      a.assetClass.includes("Transformer")
        ? "Review evidence; trigger targeted diagnostics"
        : a.assetClass.includes("Vegetation")
        ? "Priority corridor inspection; confirm hotspots"
        : "Review evidence; validate with inspection/test";

    return {
      id: `AL-${a.id}-${family.replace(/\s/g, "")}`,
      assetId: a.id,
      assetName: a.name,
      assetClass: a.assetClass,
      region: a.region,
      indicatorFamily: family,
      indicator,
      severity,
      score,
      delta7d,
      change,
      recommendedNext,
      evidence: buildEvidence(a, family, score),
      trend: makeTrend(a.risk + a.health + a.criticality, family),
    };
  });

  const filtered =
    selectedFamily === "All" ? base : base.filter((x) => x.indicatorFamily === selectedFamily);

  return filtered.sort((x, y) => y.score - x.score).slice(0, 26);
}

function Sparkline({
  values,
  threshold = 70,
}: {
  values: number[];
  threshold?: number;
}) {
  const w = 130;
  const h = 30;
  const pad = 2;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const pts = values
    .map((v, i) => {
      const x = pad + (i * (w - pad * 2)) / (values.length - 1);
      const y = h - pad - ((v - min) / span) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  // threshold line mapped into local scale
  const t = clamp(threshold, min, max);
  const ty = h - pad - ((t - min) / span) * (h - pad * 2);

  const last = values[values.length - 1];
  const prev = values[values.length - 2] ?? last;
  const delta = last - prev;

  return (
    <div className="flex items-center gap-2">
      <svg width={w} height={h} className="block text-[var(--seb-blue)]">
        <rect x="0" y="0" width={w} height={h} fill="transparent" />
        <line
          x1="0"
          y1={ty}
          x2={w}
          y2={ty}
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.25"
        />
        <polyline
          points={pts}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          opacity="0.85"
        />
        {/* last point */}
        <circle
          cx={w - pad}
          cy={h - pad - ((last - min) / span) * (h - pad * 2)}
          r="2.5"
          fill="currentColor"
          opacity="0.9"
        />
      </svg>
      <div className="text-[11px] text-gray-600 whitespace-nowrap">
        <div className="font-medium text-gray-800">{last}</div>
        <div className={`${delta >= 0 ? "text-amber-700" : "text-emerald-700"}`}>
          {delta >= 0 ? `+${delta}` : `${delta}`}{" "}
          <span className="text-gray-400">/step</span>
        </div>
      </div>
    </div>
  );
}

export default function AnomaliesPage() {
  const [severity, setSeverity] = useState<Severity | "All">("All");
  const [family, setFamily] = useState<IndicatorFamily | "All">("All");
  const [selected, setSelected] = useState<Alert | null>(null);

  const alerts = useMemo(() => buildAlerts(family), [family]);

  const filtered = useMemo(() => {
    if (severity === "All") return alerts;
    return alerts.filter((a) => a.severity === severity);
  }, [alerts, severity]);

  const stats = useMemo(() => {
    const high = alerts.filter((a) => a.severity === "High").length;
    const med = alerts.filter((a) => a.severity === "Medium").length;
    const low = alerts.filter((a) => a.severity === "Low").length;
    return { high, med, low, total: alerts.length };
  }, [alerts]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--seb-navy)]">
            Trend Anomaly Detection (Phase 2+)
          </h1>
          <p className="text-sm text-gray-600">
            Alert inbox with indicator trends and “what changed” context. Indices shown as{" "}
            <span className="font-medium">0–100</span> (demo).
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link className="underline text-[var(--seb-blue)]" href="/predictive">
            Predictive Hub
          </Link>
          <Link className="underline text-[var(--seb-blue)]" href="/assets">
            Asset Intelligence
          </Link>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid md:grid-cols-4 gap-5">
        <div className="rounded-xl bg-white border shadow-sm p-5">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Alerts in view</div>
          <div className="mt-1 text-2xl font-semibold text-[var(--seb-navy)]">{stats.total}</div>
        </div>
        <div className="rounded-xl bg-white border shadow-sm p-5">
          <div className="text-xs text-gray-500 uppercase tracking-wide">High</div>
          <div className="mt-1 text-2xl font-semibold text-red-700">{stats.high}</div>
        </div>
        <div className="rounded-xl bg-white border shadow-sm p-5">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Medium</div>
          <div className="mt-1 text-2xl font-semibold text-amber-700">{stats.med}</div>
        </div>
        <div className="rounded-xl bg-white border shadow-sm p-5">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Low</div>
          <div className="mt-1 text-2xl font-semibold text-emerald-700">{stats.low}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl bg-white border shadow-sm p-6">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <div className="font-semibold text-[var(--seb-navy)]">Indicator</div>
            <div className="text-xs text-gray-500 mt-1">Switch the monitoring lens (demo).</div>
            <select
              value={family}
              onChange={(e) => {
                setFamily(e.target.value as any);
                setSelected(null);
              }}
              className="mt-3 w-full rounded-lg border px-3 py-2 text-sm"
            >
              <option value="All">All indicators</option>
              {INDICATORS.map((x) => (
                <option key={x.family} value={x.family}>
                  {x.label}
                </option>
              ))}
            </select>
            {family !== "All" ? (
              <div className="mt-2 text-xs text-gray-500">
                {INDICATORS.find((x) => x.family === family)?.hint}
              </div>
            ) : null}
          </div>

          <div>
            <div className="font-semibold text-[var(--seb-navy)]">Severity</div>
            <div className="text-xs text-gray-500 mt-1">Filter by severity to focus attention.</div>
            <select
              value={severity}
              onChange={(e) => {
                setSeverity(e.target.value as any);
                setSelected(null);
              }}
              className="mt-3 w-full rounded-lg border px-3 py-2 text-sm"
            >
              <option value="All">All</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>

            <div className="mt-3 text-xs text-gray-500">
              Boundary: alerts don’t create work orders; they feed prioritization and evidence packs.
            </div>
          </div>
        </div>
      </div>

      {/* Inbox + side panel */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl bg-white border shadow-sm overflow-hidden">
          <div className="p-6 border-b">
            <div className="font-semibold text-[var(--seb-navy)]">Alert inbox</div>
            <div className="text-xs text-gray-500 mt-1">
              Click a row to open evidence & recommended actions. Asset ID links to drill-down.
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="p-3">Asset</th>
                  <th className="p-3">Indicator</th>
                  <th className="p-3">Severity</th>
                  <th className="p-3">Score</th>
                  <th className="p-3">Δ 7d</th>
                  <th className="p-3">Trend</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => {
                  const active = selected?.id === a.id;
                  return (
                    <tr
                      key={a.id}
                      className={`border-t cursor-pointer hover:bg-gray-50 ${active ? "bg-blue-50" : ""}`}
                      onClick={() => setSelected(a)}
                      title="Click to open details"
                    >
                      <td className="p-3 font-medium">
                        <Link
                          className="underline"
                          href={`/assets/item/${a.assetId}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {a.assetId}
                        </Link>
                        <div className="text-xs text-gray-500">
                          {a.assetClass} · {a.region}
                        </div>
                      </td>
                      <td className="p-3">{a.indicator}</td>
                      <td className="p-3">
                        {a.severity === "High"
                          ? pill("High", "red")
                          : a.severity === "Medium"
                          ? pill("Medium", "amber")
                          : pill("Low", "green")}
                      </td>
                      <td className="p-3 font-semibold text-[var(--seb-navy)]">{a.score}</td>
                      <td className="p-3">
                        <span className={`${a.delta7d >= 0 ? "text-amber-700" : "text-emerald-700"} font-medium`}>
                          {a.delta7d >= 0 ? `+${a.delta7d}` : `${a.delta7d}`}
                        </span>
                      </td>
                      <td className="p-3">
                        <Sparkline values={a.trend} threshold={70} />
                      </td>
                    </tr>
                  );
                })}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-gray-500">
                      No alerts under this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t text-xs text-gray-500">
            Demo boundary: anomalies inform prioritization and diagnostics triggers; execution remains in Maximo.
          </div>
        </div>

        {/* Side panel */}
        <div className="rounded-xl bg-white border shadow-sm p-6">
          {!selected ? (
            <div className="space-y-2">
              <div className="font-semibold text-[var(--seb-navy)]">Alert details</div>
              <div className="text-sm text-gray-600">
                Select an alert to view evidence, what changed, and recommended next steps.
              </div>
              <div className="mt-4 rounded-lg bg-gray-50 p-4 text-xs text-gray-600 space-y-2">
                <div className="font-medium text-[var(--seb-navy)]">How this is used</div>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Engineering triage and diagnostics triggers</li>
                  <li>Evidence pack for outage planning discussions</li>
                  <li>Input into PoF/RUL models over time</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Selected alert</div>
                <div className="mt-1 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-[var(--seb-navy)]">{selected.assetId}</div>
                    <div className="text-xs text-gray-500">{selected.assetName}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {selected.severity === "High"
                      ? pill("High", "red")
                      : selected.severity === "Medium"
                      ? pill("Medium", "amber")
                      : pill("Low", "green")}
                    {pill(`${selected.score}/100`, "gray")}
                  </div>
                </div>

                <div className="mt-2 text-xs text-gray-600">
                  {selected.assetClass} · {selected.region}
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <div className="font-medium text-[var(--seb-navy)]">What changed</div>
                <div className="text-sm text-gray-700 mt-2">{selected.change}</div>
                <div className="text-xs text-gray-500 mt-2">
                  Δ 7d:{" "}
                  <span className={`${selected.delta7d >= 0 ? "text-amber-700" : "text-emerald-700"} font-medium`}>
                    {selected.delta7d >= 0 ? `+${selected.delta7d}` : `${selected.delta7d}`}
                  </span>
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <div className="font-medium text-[var(--seb-navy)]">Recommended next step</div>
                <div className="text-sm text-gray-700 mt-2">{selected.recommendedNext}</div>
                <div className="mt-3 flex gap-2 flex-wrap text-xs">
                  {pill("No work order created", "gray")}
                  {pill("Evidence pack ready", "blue")}
                  {pill("Feeds PoF/RUL", "green")}
                </div>
              </div>

              <div className="space-y-3">
                <div className="font-medium text-[var(--seb-navy)]">Evidence (demo)</div>
                {selected.evidence.map((e) => (
                  <div key={e.title} className="rounded-lg border p-4">
                    <div className="font-medium text-sm text-[var(--seb-navy)]">{e.title}</div>
                    <ul className="mt-2 list-disc pl-5 text-sm text-gray-700 space-y-1">
                      {e.points.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between text-sm">
                <Link className="underline text-[var(--seb-blue)]" href={`/assets/item/${selected.assetId}`}>
                  Open asset drill-down
                </Link>
                <button
                  onClick={() => setSelected(null)}
                  className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}