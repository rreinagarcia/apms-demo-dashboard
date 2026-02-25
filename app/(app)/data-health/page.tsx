"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { assets } from "@/lib/mock";

type DataDomain =
  | "Condition monitoring"
  | "Inspections & tests"
  | "Work history (Maximo)"
  | "Asset registry"
  | "Outage & operations"
  | "Environment & exposure";

type Row = {
  assetClass: string;
  count: number;

  // simple demo metrics (0–100)
  coverage: number; // % assets with data
  freshness: number; // % within freshness threshold
  quality: number; // completeness/consistency proxy
  confidence: number; // model confidence proxy
};

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
  tone = "gray",
}: {
  label: string;
  value: string;
  tone?: "blue" | "green" | "amber" | "gray";
}) {
  const border =
    tone === "green"
      ? "border-l-4 border-[var(--seb-green)]"
      : tone === "amber"
      ? "border-l-4 border-amber-400"
      : tone === "blue"
      ? "border-l-4 border-[var(--seb-blue)]"
      : "border-l-4 border-gray-200";

  return (
    <div className={`rounded-xl bg-white border shadow-sm p-5 ${border}`}>
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-[var(--seb-navy)]">{value}</div>
    </div>
  );
}

function pill(text: string, tone: "blue" | "green" | "gray" | "amber" | "red") {
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

function scoreColor(v: number) {
  if (v >= 80) return "bg-emerald-500";
  if (v >= 60) return "bg-amber-500";
  return "bg-red-500";
}

function scoreLabel(v: number) {
  if (v >= 80) return { label: "Good", tone: "green" as const };
  if (v >= 60) return { label: "Partial", tone: "amber" as const };
  return { label: "Low", tone: "red" as const };
}

// deterministic-ish (no randomness) “demo realism” per class
function deriveScores(assetClass: string, count: number): Row {
  // Baselines by common utility maturity patterns (illustrative)
  const base =
    assetClass.includes("Power Transformer")
      ? { coverage: 78, freshness: 72, quality: 70, confidence: 68 }
      : assetClass.includes("Distribution Transformer")
      ? { coverage: 62, freshness: 58, quality: 60, confidence: 55 }
      : assetClass.includes("Switchgear")
      ? { coverage: 66, freshness: 61, quality: 63, confidence: 57 }
      : assetClass.includes("Circuit Breaker")
      ? { coverage: 64, freshness: 60, quality: 61, confidence: 56 }
      : assetClass.includes("Overhead Line")
      ? { coverage: 54, freshness: 50, quality: 55, confidence: 48 }
      : assetClass.includes("Underground Cable")
      ? { coverage: 58, freshness: 54, quality: 58, confidence: 50 }
      : assetClass.includes("Substation")
      ? { coverage: 70, freshness: 62, quality: 65, confidence: 58 }
      : assetClass.includes("Protection")
      ? { coverage: 60, freshness: 56, quality: 62, confidence: 52 }
      : assetClass.includes("Vegetation")
      ? { coverage: 52, freshness: 62, quality: 57, confidence: 45 }
      : { coverage: 55, freshness: 55, quality: 55, confidence: 50 };

  // Mild adjustment with fleet size for that class (bigger fleets are harder to keep fresh)
  const sizePenalty = Math.min(8, Math.max(0, count - 6)); // cap
  const adj = {
    coverage: Math.max(35, base.coverage - Math.round(sizePenalty * 0.6)),
    freshness: Math.max(30, base.freshness - Math.round(sizePenalty * 0.7)),
    quality: Math.max(35, base.quality - Math.round(sizePenalty * 0.5)),
    confidence: Math.max(25, base.confidence - Math.round(sizePenalty * 0.8)),
  };

  return {
    assetClass,
    count,
    ...adj,
  };
}

export default function DataHealthPage() {
  const [domain, setDomain] = useState<DataDomain>("Condition monitoring");

  const classCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of assets) map[a.assetClass] = (map[a.assetClass] || 0) + 1;
    return Object.entries(map)
      .map(([assetClass, count]) => ({ assetClass, count }))
      .sort((a, b) => b.count - a.count);
  }, []);

  const rows = useMemo<Row[]>(() => {
    return classCounts
      .map((c) => deriveScores(c.assetClass, c.count))
      .sort((a, b) => (b.coverage + b.freshness + b.quality + b.confidence) - (a.coverage + a.freshness + a.quality + a.confidence));
  }, [classCounts]);

  const fleetKPIs = useMemo(() => {
    const n = rows.length || 1;
    const avg = (k: keyof Row) => Math.round(rows.reduce((s, r) => s + (r[k] as number), 0) / n);

    const coverage = avg("coverage");
    const freshness = avg("freshness");
    const quality = avg("quality");
    const confidence = avg("confidence");

    const readyClasses = rows.filter((r) => r.coverage >= 70 && r.freshness >= 65).length;

    return { coverage, freshness, quality, confidence, readyClasses };
  }, [rows]);

  const domainNotes = useMemo(() => {
    const notes: Record<DataDomain, string[]> = {
      "Condition monitoring": [
        "Sensors/online monitoring coverage and timeliness (e.g., DGA, PD, temperature).",
        "Used for anomaly detection, PoF signals, and early warning dashboards.",
      ],
      "Inspections & tests": [
        "Offline test results, inspection findings, defect coding, and photos.",
        "Used for asset health scoring and evidence for recommendations.",
      ],
      "Work history (Maximo)": [
        "Read-only: work orders, failure codes, maintenance history, backlogs.",
        "APMS uses it for learning + prioritization — execution remains in Maximo.",
      ],
      "Asset registry": [
        "Nameplate, configuration, age, manufacturer, location, and hierarchy.",
        "Baseline for asset segmentation and cohort planning.",
      ],
      "Outage & operations": [
        "Switching events, outage history, loading/operations, feeder criticality.",
        "Used to quantify consequence proxy and operational constraints.",
      ],
      "Environment & exposure": [
        "Flood/wildfire risk, vegetation exposure, lightning, coastal corrosion, access.",
        "Used to contextualize risk drivers and resilience programs.",
      ],
    };
    return notes[domain];
  }, [domain]);

  const improvementBacklog = useMemo(() => {
    // simple list that feels realistic without being too deep
    return [
      { item: "Standardize defect taxonomy (across asset classes)", owner: "Asset Mgmt", eta: "6–8 weeks" },
      { item: "Improve inspection digitization & photo evidence capture", owner: "Field Ops", eta: "8–12 weeks" },
      { item: "Maximo work history extract (read-only) for model calibration", owner: "IT / EAM", eta: "4–6 weeks" },
      { item: "Data freshness SLAs for key indicators (DGA/PD/thermography)", owner: "Reliability", eta: "6–10 weeks" },
      { item: "Fleet-level calibration workshop (weights/thresholds)", owner: "Reliability + SMEs", eta: "2–3 weeks" },
    ];
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--seb-navy)]">Data & Model Health</h1>
          <p className="text-sm text-gray-600">
            Demonstrates trustworthiness: coverage, freshness, quality, and confidence (demo metrics).
          </p>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <Link className="underline text-[var(--seb-blue)]" href="/assets">
            Asset Intelligence
          </Link>
          <Link className="underline text-[var(--seb-blue)]" href="/analytics">
            Portfolio Analytics
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid md:grid-cols-5 gap-5">
        <KPI label="Avg coverage" value={`${fleetKPIs.coverage}%`} tone={fleetKPIs.coverage >= 70 ? "green" : "amber"} />
        <KPI label="Avg freshness" value={`${fleetKPIs.freshness}%`} tone={fleetKPIs.freshness >= 65 ? "green" : "amber"} />
        <KPI label="Avg data quality" value={`${fleetKPIs.quality}%`} tone={fleetKPIs.quality >= 65 ? "green" : "amber"} />
        <KPI label="Avg model confidence" value={`${fleetKPIs.confidence}%`} tone={fleetKPIs.confidence >= 65 ? "green" : "amber"} />
        <KPI label="Classes “ready”" value={`${fleetKPIs.readyClasses}`} tone="blue" />
      </div>

      {/* Domain selector */}
      <Card
        title="Domain lens"
        subtitle="Switch lens to show different readiness narratives (without changing core pages)."
      >
        <div className="grid md:grid-cols-3 gap-4 items-start">
          <div className="space-y-2">
            <div className="text-xs text-gray-500">Data domain</div>
            <select
              value={domain}
              onChange={(e) => setDomain(e.target.value as DataDomain)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            >
              <option>Condition monitoring</option>
              <option>Inspections & tests</option>
              <option>Work history (Maximo)</option>
              <option>Asset registry</option>
              <option>Outage & operations</option>
              <option>Environment & exposure</option>
            </select>
          </div>

          <div className="md:col-span-2 rounded-lg bg-gray-50 border p-4 text-sm text-gray-700">
            <div className="text-xs text-gray-500 uppercase tracking-wide">What this lens means</div>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              {domainNotes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      {/* Class readiness table */}
      <Card
        title="Readiness by asset class"
        subtitle="Demo scoring (0–100). In production, computed from actual field coverage/freshness rules and audit checks."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="p-3">Asset class</th>
                <th className="p-3">Count</th>
                <th className="p-3">Coverage</th>
                <th className="p-3">Freshness</th>
                <th className="p-3">Quality</th>
                <th className="p-3">Confidence</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const avg = Math.round((r.coverage + r.freshness + r.quality + r.confidence) / 4);
                const status = scoreLabel(avg);

                return (
                  <tr key={r.assetClass} className="border-t hover:bg-gray-50">
                    <td className="p-3 font-medium text-[var(--seb-navy)]">{r.assetClass}</td>
                    <td className="p-3">{r.count}</td>

                    {(["coverage", "freshness", "quality", "confidence"] as const).map((k) => (
                      <td key={k} className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="h-2 w-24 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full ${scoreColor(r[k])}`} style={{ width: `${r[k]}%` }} />
                          </div>
                          <span className="text-gray-700">{r[k]}%</span>
                        </div>
                      </td>
                    ))}

                    <td className="p-3">
                      {pill(status.label, status.tone === "green" ? "green" : status.tone === "amber" ? "amber" : "red")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 rounded-lg bg-gray-50 border p-4 text-xs text-gray-600">
          <div className="font-medium text-[var(--seb-navy)] mb-1">Interpretation (demo)</div>
          <ul className="list-disc pl-5 space-y-1">
            <li>“Coverage” = % assets with required data fields for the selected lens.</li>
            <li>“Freshness” = % assets updated within a threshold (e.g., last 30/90 days depending on indicator).</li>
            <li>“Confidence” = proxy for how stable outputs are given data density and calibration maturity.</li>
          </ul>
        </div>
      </Card>

      {/* Backlog */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card
          title="Data improvement backlog"
          subtitle="Concrete actions that unlock better analytics without new systems."
        >
          <div className="space-y-3">
            {improvementBacklog.map((b) => (
              <div key={b.item} className="rounded-lg border p-4">
                <div className="font-medium text-[var(--seb-navy)]">{b.item}</div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {pill(`Owner: ${b.owner}`, "gray")}
                  {pill(`ETA: ${b.eta}`, "blue")}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card
          title="Model governance (Phase 1 → Phase 2+)"
          subtitle="How SEB stays confident as predictive modules are added."
        >
          <div className="space-y-3 text-sm text-gray-700">
            <div className="rounded-lg border p-4">
              <div className="text-xs text-gray-500">Calibration</div>
              <div className="mt-1">
                Tune weights/thresholds using SEB failure history + outage impacts + SME validation workshops.
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-xs text-gray-500">Monitoring</div>
              <div className="mt-1">
                Track drift: data freshness, indicator distribution shifts, alert volumes, and false positives.
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-xs text-gray-500">Explainability</div>
              <div className="mt-1">
                Every recommendation ties back to evidence (drivers, trends, history) — no “black box” approvals.
              </div>
            </div>

            <div className="rounded-lg bg-gray-50 border p-4 text-xs text-gray-600">
              Next: add <span className="font-medium text-gray-800">Predictive Analytics (Phase 2+)</span> pages that reference this readiness view.
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}