"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { assets } from "@/lib/mock";
import { useParams } from "next/navigation";

type Horizon = "1Y" | "3Y" | "5Y";
const HORIZONS: Horizon[] = ["1Y", "3Y", "5Y"];

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

function bandPill(band?: string) {
  if (band === "High") return pill("High", "red");
  if (band === "Medium") return pill("Medium", "amber");
  return pill("Low", "green");
}

function fmt1(n: number) {
  return new Intl.NumberFormat("en-MY", { maximumFractionDigits: 1 }).format(n);
}

function fmt0(n: number) {
  return new Intl.NumberFormat("en-MY", { maximumFractionDigits: 0 }).format(n);
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

/** Deterministic hash for stable “demo randomness” */
function hashTo01(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // 0..1
  return ((h >>> 0) % 10000) / 10000;
}

/** --- Predictive helper logic (demo-only, kept local so no extra imports) --- **/

function failureCostRMm(assetClass: string) {
  // simple, believable class-based CoF proxy (RM million)
  if (assetClass.includes("Power Transformer")) return 18;
  if (assetClass.includes("Distribution Transformer")) return 4;
  if (assetClass.includes("Switchgear")) return 6;
  if (assetClass.includes("Circuit Breaker")) return 3.5;
  if (assetClass.includes("Overhead Line")) return 2.2;
  if (assetClass.includes("Underground Cable")) return 5.5;
  if (assetClass.includes("Substation")) return 12;
  if (assetClass.includes("Protection")) return 1.8;
  if (assetClass.includes("Vegetation")) return 1.2;
  return 3;
}

function pofIndexFromHealthRisk(health: number, risk: number) {
  // proxy: higher risk + lower health -> higher PoF index
  const idx = Math.round(risk * 0.75 + (100 - health) * 0.45);
  return clamp(idx, 0, 100);
}

/**
 * PoF% mapping that:
 * - changes with horizon
 * - introduces small, deterministic, horizon-dependent re-ordering across assets
 *   (so ranking can shift between 1Y / 3Y / 5Y)
 */
function pofPctFromIndex(index0to100: number, horizon: Horizon, assetId: string, assetClass: string) {
  const base = clamp(index0to100, 1, 98);

  // Horizon scaling (larger horizon => generally higher probability)
  const horizonMult = horizon === "1Y" ? 0.42 : horizon === "3Y" ? 0.80 : 1.10;

  // Some classes “age” into longer horizons more strongly (believable behavior)
  const classHorizonBoost =
    assetClass.includes("Power Transformer") ? (horizon === "5Y" ? 1.12 : 1.0) :
    assetClass.includes("Underground Cable") ? (horizon === "5Y" ? 1.10 : 1.0) :
    assetClass.includes("Switchgear") ? (horizon === "3Y" ? 1.05 : 1.0) :
    assetClass.includes("Vegetation") ? (horizon === "1Y" ? 1.08 : 1.0) :
    1.0;

  // Deterministic jitter that depends on (assetId, horizon) so ranking can move slightly
  // Keep it small so it looks realistic (± ~4 percentage points max effect)
  const j01 = hashTo01(`${assetId}|${horizon}`);
  const jitter = (j01 - 0.5) * 8; // -4..+4

  const pctRaw = (base * horizonMult * classHorizonBoost) / 2 + jitter;

  // Clamp to a reasonable band for demo (1..65%)
  const pct = clamp(pctRaw, 1, 65);
  return Number(pct.toFixed(1));
}

function rulDrivers(assetClass: string) {
  if (assetClass.includes("Power Transformer"))
    return ["Insulation ageing", "DGA trend", "Moisture ingress", "Bushing condition"];
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

function computeRulYears(health: number, risk: number) {
  // consistent with your RUL page style
  const base = Math.max(0.6, (health / 100) * 14);
  const penalty = (risk / 100) * 6;
  const p50 = Math.max(0.5, Number((base - penalty).toFixed(1)));
  const p90 = Math.max(0.3, Number((p50 * 0.65).toFixed(1)));
  return { p50, p90 };
}

function anomalyScore(risk: number, health: number) {
  // similar to anomalies page: pushes up with risk + low health
  return clamp(Math.round(risk * 0.8 + (100 - health) * 0.35), 0, 100);
}

function anomalySeverity(score: number) {
  if (score >= 78) return "High";
  if (score >= 55) return "Medium";
  return "Low";
}

/** --- Evidence & Confidence (demo) --- **/

function monthsAgoLabel(monthsAgo: number) {
  if (monthsAgo <= 0) return "This month";
  if (monthsAgo === 1) return "1 month ago";
  return `${monthsAgo} months ago`;
}

function confidenceFromSignals(freshnessPct: number, missingSignals: number) {
  if (freshnessPct >= 93 && missingSignals <= 1) return { label: "High", tone: "green" as const };
  if (freshnessPct >= 88 && missingSignals <= 3) return { label: "Medium", tone: "amber" as const };
  return { label: "Low", tone: "red" as const };
}

/** --- UI components --- **/

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
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

function KPI({ label, value, tone }: { label: string; value: string; tone?: "blue" | "green" | "amber" | "gray" }) {
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

export default function AssetDetail() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const asset = useMemo(() => assets.find((a) => a.id === id), [id]);
  const [horizon, setHorizon] = useState<Horizon>("3Y");

  if (!asset) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold text-[var(--seb-navy)]">Asset not found</h1>
        <Link className="underline text-[var(--seb-blue)]" href="/assets">
          Back to Asset Intelligence
        </Link>
      </div>
    );
  }

  // --- Core scores ---
  const cofRMm = failureCostRMm(asset.assetClass);
  const pofIdx = pofIndexFromHealthRisk(asset.health, asset.risk);

  // --- PoF across horizons (for the card table) ---
  const pofRows = useMemo(() => {
    return HORIZONS.map((h) => {
      const pofPct = pofPctFromIndex(pofIdx, h, asset.id, asset.assetClass);
      const exposure = Number(((pofPct / 100) * cofRMm).toFixed(2));
      return { h, pofPct, exposureRMm: exposure };
    });
  }, [asset.assetClass, asset.id, cofRMm, pofIdx]);

  // --- Ranking that can change by horizon (fleet context) ---
  const horizonRanking = useMemo(() => {
    const list = assets.map((a) => {
      const idx = pofIndexFromHealthRisk(a.health, a.risk);
      const pct = pofPctFromIndex(idx, horizon, a.id, a.assetClass);
      return { id: a.id, pct };
    });

    // Higher PoF% = worse; sort desc
    list.sort((a, b) => b.pct - a.pct);

    const n = list.length || 1;
    const pos = Math.max(0, list.findIndex((x) => x.id === asset.id));
    const rank = pos + 1;
    const percentileWorst = ((rank / n) * 100); // 100% = worst end
    const percentileBest = 100 - percentileWorst; // 100% = best end

    const current = list[pos]?.pct ?? pofRows.find((r) => r.h === horizon)?.pofPct ?? 0;

    return {
      n,
      rank,
      pofPct: current,
      percentileWorst: Number(percentileWorst.toFixed(1)),
      percentileBest: Number(percentileBest.toFixed(1)),
    };
  }, [asset.assetClass, asset.id, horizon, pofRows]);

  // --- RUL ---
  const { p50, p90 } = computeRulYears(asset.health, asset.risk);
  const driverList = rulDrivers(asset.assetClass);
  const dominantDriver = driverList[(asset.health + asset.risk + asset.criticality) % driverList.length];

  // --- Anomaly ---
  const anomaly = anomalyScore(asset.risk, asset.health);
  const sev = anomalySeverity(anomaly);

  // --- Evidence & confidence (demo) ---
  const evidence = useMemo(() => {
    const seed = hashTo01(asset.id);

    // Freshness 84–99%
    const freshnessPct = Math.round(84 + seed * 15);

    // Missing signals 0–5 (more missing for some classes, just to make it believable)
    const classPenalty =
      asset.assetClass.includes("Vegetation") ? 1 :
      asset.assetClass.includes("Overhead Line") ? 1 :
      asset.assetClass.includes("Protection") ? 2 :
      0;

    const missingSignals = clamp(Math.round(seed * 5) + classPenalty - 1, 0, 6);

    const conf = confidenceFromSignals(freshnessPct, missingSignals);

    // “Last readings” in months ago (0..10)
    const lastOilMonths = clamp(Math.round(hashTo01(asset.id + "|oil") * 10), 0, 10);
    const lastPdMonths = clamp(Math.round(hashTo01(asset.id + "|pd") * 10), 0, 10);
    const lastInspMonths = clamp(Math.round(hashTo01(asset.id + "|insp") * 10), 0, 10);

    // Evidence coverage: 3-6 sources, subtract missing
    const sourcesTotal = clamp(6 - Math.round(seed * 3), 3, 6);
    const sourcesUsed = clamp(sourcesTotal - Math.min(missingSignals, 3), 2, 6);

    return {
      freshnessPct,
      missingSignals,
      confidence: conf,
      sourcesUsed,
      sourcesTotal,
      lastOilMonths,
      lastPdMonths,
      lastInspMonths,
    };
  }, [asset.assetClass, asset.id]);

  const repair = asset.repairVsReplace?.repair;
  const replace = asset.repairVsReplace?.replace;

  const recommended = useMemo(() => {
    const out: { title: string; why: string; notes: string[] }[] = [];

    // 1) Risk-based recommendation
    if (asset.risk >= 75) {
      out.push({
        title: "Prioritize intervention in next outage window",
        why: "High risk score and elevated failure exposure (demo).",
        notes: [
          "Validate dominant degradation mode with targeted diagnostics.",
          "Prepare outage-ready work pack; pre-stage spares if needed.",
        ],
      });
    } else if (asset.risk >= 55) {
      out.push({
        title: "Enhanced monitoring + targeted inspection",
        why: "Medium risk with actionable leading indicators.",
        notes: ["Trigger focused tests for the dominant driver.", "Re-evaluate risk after new evidence is ingested."],
      });
    } else {
      out.push({
        title: "Maintain standard monitoring",
        why: "Lower risk score and stable leading indicators (demo).",
        notes: ["Keep condition-based inspection cadence.", "Reassess if anomaly score increases."],
      });
    }

    // 2) Anomaly-based recommendation
    out.push({
      title: `Anomaly triage: ${sev} severity`,
      why: "Trend deviation signal from condition indicators (demo).",
      notes:
        sev === "High"
          ? ["Review last 30 days indicator drift.", "Escalate for engineering review within 7 days."]
          : sev === "Medium"
          ? ["Validate sensor / data quality.", "Schedule inspection in next planned visit."]
          : ["Monitor; no immediate action required."],
    });

    // 3) Repair vs replace (if available)
    if (repair || replace) {
      out.push({
        title: "Repair vs Replace decision pack (demo)",
        why: "Compare OPEX work pack vs CAPEX renewal for risk reduction.",
        notes: [
          repair ? `Repair: RM ${fmt1(repair.costRMm)}m → Risk ↓ ${repair.riskReduction}` : "Repair option not modeled.",
          replace ? `Replace: RM ${fmt1(replace.costRMm)}m → Risk ↓ ${replace.riskReduction}` : "Replace option not modeled.",
          "Final approval and work order execution remains in Maximo (boundary).",
        ],
      });
    }

    // 4) Evidence / confidence note
    out.push({
      title: "Evidence completeness check",
      why: "Model confidence depends on data freshness and indicator coverage.",
      notes: [
        `Data freshness: ${evidence.freshnessPct}% · Sources used: ${evidence.sourcesUsed}/${evidence.sourcesTotal}`,
        evidence.missingSignals > 0 ? `Missing signals: ${evidence.missingSignals} (demo)` : "No missing signals flagged (demo).",
        "If confidence is Medium/Low, prioritize data validation before committing budget.",
      ],
    });

    return out;
  }, [asset.risk, evidence.freshnessPct, evidence.missingSignals, evidence.sourcesTotal, evidence.sourcesUsed, repair, replace, sev]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--seb-navy)]">{asset.id}</h1>
          <div className="text-sm text-gray-600 mt-1">
            {asset.assetClass} · {asset.region}
          </div>
          <div className="text-xs text-gray-500 mt-1">{asset.name}</div>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <Link className="underline text-[var(--seb-blue)]" href="/assets">
            Back to Asset Intelligence
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid md:grid-cols-4 gap-5">
        <KPI label="Health (0–100)" value={`${asset.health}`} tone="gray" />
        <KPI label="Criticality (0–100)" value={`${asset.criticality}`} tone="gray" />
        <KPI label="Risk (0–100)" value={`${asset.risk}`} tone={asset.risk >= 70 ? "amber" : "blue"} />
        <KPI label="Risk band" value={`${asset.riskBand}`} tone={asset.riskBand === "High" ? "amber" : "gray"} />
      </div>

      {/* Evidence & confidence */}
      <Card
        title="Evidence & model confidence (demo)"
        subtitle="Shows whether the predictive view is decision-ready; encourages data validation before execution."
      >
        <div className="flex flex-wrap gap-2 items-center">
          {pill(`Data freshness: ${evidence.freshnessPct}%`, evidence.freshnessPct >= 92 ? "green" : evidence.freshnessPct >= 88 ? "amber" : "red")}
          {pill(`Signals used: ${evidence.sourcesUsed}/${evidence.sourcesTotal}`, evidence.sourcesUsed >= evidence.sourcesTotal - 1 ? "green" : "amber")}
          {pill(`Missing signals: ${evidence.missingSignals}`, evidence.missingSignals <= 1 ? "green" : evidence.missingSignals <= 3 ? "amber" : "red")}
          {pill(`Confidence: ${evidence.confidence.label}`, evidence.confidence.tone)}
        </div>

        <div className="grid md:grid-cols-3 gap-4 mt-3">
          <div className="rounded-lg border p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wide">Last oil / DGA evidence</div>
            <div className="mt-1 text-sm font-medium text-[var(--seb-navy)]">{monthsAgoLabel(evidence.lastOilMonths)}</div>
            <div className="text-xs text-gray-500 mt-1">Used for transformer-related degradation signals.</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wide">Last PD / condition evidence</div>
            <div className="mt-1 text-sm font-medium text-[var(--seb-navy)]">{monthsAgoLabel(evidence.lastPdMonths)}</div>
            <div className="text-xs text-gray-500 mt-1">Used for switchgear/cable insulation signals.</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wide">Last inspection / patrol</div>
            <div className="mt-1 text-sm font-medium text-[var(--seb-navy)]">{monthsAgoLabel(evidence.lastInspMonths)}</div>
            <div className="text-xs text-gray-500 mt-1">Used for validation and work-pack readiness.</div>
          </div>
        </div>

        <div className="text-xs text-gray-500">
          Demo note: In production, these are derived from actual ingestion timestamps and data-quality rules.
        </div>
      </Card>

      {/* Unified predictive summary */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card
          title="Probability of Failure & Exposure (demo)"
          subtitle="Ranking changes by horizon because deterioration patterns differ and uncertainty grows over time."
        >
          <div className="flex flex-wrap gap-2 items-center">
            {pill(`PoF index: ${pofIdx}/100`, "blue")}
            {pill(`CoF proxy: RM ${fmt1(cofRMm)}m`, "gray")}
            {pill(`Selected horizon: ${horizon}`, "gray")}
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-gray-500">Horizon view (rank across fleet)</div>
              <div className="mt-1 text-sm text-gray-700">
                Rank: <span className="font-semibold text-[var(--seb-navy)]">{horizonRanking.rank}</span> / {horizonRanking.n}{" "}
                <span className="text-xs text-gray-500">
                  (worse-end percentile: {horizonRanking.percentileWorst}%)
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                This is why “worst assets” can change between 1Y vs 5Y planning.
              </div>
            </div>

            <select
              value={horizon}
              onChange={(e) => setHorizon(e.target.value as Horizon)}
              className="rounded-lg border px-3 py-2 text-sm bg-white"
              title="Change horizon to see PoF%, exposure and rank shift"
            >
              {HORIZONS.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="p-2">Horizon</th>
                  <th className="p-2">PoF (%)</th>
                  <th className="p-2">Expected exposure (RM m)</th>
                </tr>
              </thead>
              <tbody>
                {pofRows.map((r) => (
                  <tr key={r.h} className={`border-t ${r.h === horizon ? "bg-blue-50/60" : ""}`}>
                    <td className="p-2 font-medium">{r.h}</td>
                    <td className="p-2">{r.pofPct}%</td>
                    <td className="p-2 font-semibold text-[var(--seb-navy)]">{fmt1(r.exposureRMm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="text-xs text-gray-500">
            Note: In production, PoF comes from calibrated models; exposure uses SEB consequence models (SAIDI/SAIFI, repair cost, safety, etc.).
          </div>
        </Card>

        <Card
          title="RUL & End-of-Life (demo)"
          subtitle="RUL shown as P50 / P90 years with dominant driver and decision cue."
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border p-4">
              <div className="text-xs text-gray-500 uppercase tracking-wide">P50</div>
              <div className="mt-1 text-2xl font-semibold text-[var(--seb-navy)]">{p50}y</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-xs text-gray-500 uppercase tracking-wide">P90</div>
              <div className="mt-1 text-2xl font-semibold text-[var(--seb-navy)]">{p90}y</div>
            </div>
          </div>

          <div className="mt-3">
            <div className="text-xs text-gray-500">Dominant driver</div>
            <div className="mt-1 font-medium text-[var(--seb-navy)]">{dominantDriver}</div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {pill(
              p50 <= 2 ? "Cue: Replace" : p50 <= 5 ? "Cue: Repair" : "Cue: Monitor",
              p50 <= 2 ? "red" : p50 <= 5 ? "amber" : "green"
            )}
            {pill("Cohort planning (not work orders)", "gray")}
          </div>
        </Card>

        <Card
          title="Trend Anomaly Signal (demo)"
          subtitle="Single-asset anomaly score (0–100) used to triage attention."
        >
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">Anomaly score</div>
              <div className="mt-1 text-2xl font-semibold text-[var(--seb-navy)]">{anomaly}</div>
            </div>
            <div>
              {sev === "High"
                ? pill("High", "red")
                : sev === "Medium"
                ? pill("Medium", "amber")
                : pill("Low", "green")}
            </div>
          </div>

          <div className="mt-3 text-sm text-gray-700">
            {sev === "High"
              ? "Sharp deviation vs expected baseline; recommend rapid evidence review."
              : sev === "Medium"
              ? "Sustained drift above expected range; validate with inspection/test."
              : "Minor deviation; monitor trend and data quality."}
          </div>

          <div className="mt-3 text-xs text-gray-500">
            Boundary: alerts don’t create Maximo work orders; they feed prioritization and engineering review.
          </div>
        </Card>
      </div>

      {/* Recommendations */}
      <Card
        title="Recommended actions & decision pack (compiled)"
        subtitle="One place to review risk, predictive cues, and decision-ready next steps."
      >
        <div className="space-y-4">
          {recommended.map((r) => (
            <div key={r.title} className="rounded-lg border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="font-medium text-[var(--seb-navy)]">{r.title}</div>
                {bandPill(asset.riskBand)}
              </div>
              <div className="mt-1 text-sm text-gray-700">{r.why}</div>

              <ul className="mt-3 list-disc pl-6 text-sm text-gray-700 space-y-1">
                {(r.notes ?? []).map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      {/* Links to full modules (optional but handy) */}
      <div className="rounded-xl border bg-white shadow-sm p-6">
        <div className="font-semibold text-[var(--seb-navy)]">Open full modules (optional)</div>
        <div className="mt-2 flex flex-wrap gap-3 text-sm">
          <Link className="underline text-[var(--seb-blue)]" href="/predictive/pof">
            PoF Forecast
          </Link>
          <Link className="underline text-[var(--seb-blue)]" href="/predictive/rul">
            RUL & EoL Planning
          </Link>
          <Link className="underline text-[var(--seb-blue)]" href="/predictive/anomalies">
            Anomaly Detection
          </Link>
          <Link className="underline text-[var(--seb-blue)]" href="/predictive/prescriptive">
            Prescriptive Actions
          </Link>
        </div>
        <div className="mt-2 text-xs text-gray-500">
          Goal: day-to-day users can stay on this asset page; deep dives remain available when needed.
        </div>
      </div>
    </div>
  );
}