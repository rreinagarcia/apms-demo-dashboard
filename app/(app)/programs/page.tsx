"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { assets } from "@/lib/mock";

type ProgramKey =
  | "tx"
  | "switchgear"
  | "lines_cables"
  | "substations"
  | "protection_control"
  | "vegetation";

type Stage = "Draft" | "Review" | "Approved";

const PROGRAMS: {
  key: ProgramKey;
  label: string;
  desc: string;
  focus: string[];
  defaultCohort: { band: "High" | "Medium" | "Low" | "Any"; topN: number };
  typicalActions: { label: string; type: "OPEX" | "CAPEX" | "Mixed"; notes: string }[];
}[] = [
  {
    key: "tx",
    label: "Transformers",
    desc: "DGA / oil quality / insulation ageing signals; prioritize high consequence units.",
    focus: ["DGA anomalies", "Oil quality trend", "Loading stress", "Ageing / insulation", "Outage readiness"],
    defaultCohort: { band: "High", topN: 10 },
    typicalActions: [
      { label: "Targeted diagnostics (DGA, furan, moisture)", type: "OPEX", notes: "Validate failure mode and urgency." },
      { label: "Work pack (OLTC service, seals, dehydration)", type: "OPEX", notes: "Reduce near-term PoF proxy." },
      { label: "Replacement candidates shortlist", type: "CAPEX", notes: "Lead time and spares planning." },
    ],
  },
  {
    key: "switchgear",
    label: "Switchgear & Circuit Breakers",
    desc: "Partial discharge, operations count, gas quality; reduce forced outages from switching assets.",
    focus: ["PD indications", "Operations / duty", "SF6 / gas trends", "Condition assessments", "Critical feeders"],
    defaultCohort: { band: "High", topN: 10 },
    typicalActions: [
      { label: "Condition assessment + PD campaign", type: "OPEX", notes: "Confirm defect location and severity." },
      { label: "Targeted refurbishment", type: "CAPEX", notes: "Planned outage + OEM kit if needed." },
      { label: "Spare strategy & bay standardization", type: "Mixed", notes: "Reduce MTTR and simplify maintenance." },
    ],
  },
  {
    key: "lines_cables",
    label: "Lines & Cables",
    desc: "Fault rate, hotspots, exposure; focus on reliability and safety risk corridors.",
    focus: ["Fault history", "Hotspot / thermal", "Weather exposure", "Loading", "Access constraints"],
    defaultCohort: { band: "High", topN: 12 },
    typicalActions: [
      { label: "Patrol + thermography / LiDAR campaign", type: "OPEX", notes: "Find defects and clearance issues." },
      { label: "Targeted reconductoring / joint replacement", type: "CAPEX", notes: "Prioritize critical spans/sections." },
      { label: "Protection setting review for feeders", type: "OPEX", notes: "Reduce consequence and propagation." },
    ],
  },
  {
    key: "substations",
    label: "Substations",
    desc: "Site availability, major defects, flooding exposure; prioritize system nodes.",
    focus: ["Availability", "Major defect backlog", "Flood/asset exposure", "Spare capacity", "Modernization readiness"],
    defaultCohort: { band: "Any", topN: 10 },
    typicalActions: [
      { label: "Major defect clearance sprint", type: "OPEX", notes: "Risk retirement through backlog burn-down." },
      { label: "Site hardening / resilience upgrades", type: "CAPEX", notes: "Flooding, access, auxiliary systems." },
      { label: "Standardization & lifecycle refresh roadmap", type: "Mixed", notes: "Reduce complexity and OPEX." },
    ],
  },
  {
    key: "protection_control",
    label: "Protection & Control",
    desc: "Mis-ops, firmware, settings governance; reduce hidden failures and nuisance trips.",
    focus: ["Mis-operations", "Firmware/obsolescence", "Settings governance", "Test results", "Cyber posture"],
    defaultCohort: { band: "Any", topN: 12 },
    typicalActions: [
      { label: "Settings governance + audit", type: "OPEX", notes: "Reduce systemic risk." },
      { label: "Relay test & calibration campaign", type: "OPEX", notes: "Improve protection dependability." },
      { label: "Obsolescence refresh program", type: "CAPEX", notes: "Planned standardization by fleet." },
    ],
  },
  {
    key: "vegetation",
    label: "Vegetation Risk Corridors",
    desc: "ROW risk, exposure, seasonal work plan; reduce outages from vegetation contact.",
    focus: ["ROW exposure", "Seasonality", "Asset criticality overlay", "Access", "Contractor capacity"],
    defaultCohort: { band: "Any", topN: 15 },
    typicalActions: [
      { label: "Priority trimming program (high exposure)", type: "OPEX", notes: "Seasonal scheduling + contractor plan." },
      { label: "ROW inspection & hotspot mapping", type: "OPEX", notes: "LiDAR/drone + risk scoring." },
      { label: "Resilience upgrades for critical spans", type: "CAPEX", notes: "Hardening in chronic corridors." },
    ],
  },
];

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
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${cls}`}>{text}</span>;
}

function kpi(label: string, value: string, tone: "blue" | "green" | "amber" | "gray" = "gray") {
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

function fmt(n: number) {
  return new Intl.NumberFormat("en-MY", { maximumFractionDigits: 0 }).format(n);
}

// Lightweight mapping: connect programs to relevant classes in mock data.
// (Keeps demo believable without editing mock.ts again.)
function programClasses(program: ProgramKey): string[] {
  switch (program) {
    case "tx":
      return ["Power Transformer", "Distribution Transformer"];
    case "switchgear":
      return ["Switchgear (GIS/AIS)", "Circuit Breaker"];
    case "lines_cables":
      return ["Overhead Line", "Underground Cable"];
    case "substations":
      return ["Substation"];
    case "protection_control":
      return ["Protection & Control"];
    case "vegetation":
      return ["Vegetation Zone"];
    default:
      return [];
  }
}

function bandTone(b: string) {
  if (b === "High") return "red";
  if (b === "Medium") return "amber";
  if (b === "Low") return "green";
  return "gray";
}

export default function ProgramsPage() {
  const [program, setProgram] = useState<ProgramKey>("tx");
  const [stage, setStage] = useState<Stage>("Draft");
  const [band, setBand] = useState<"High" | "Medium" | "Low" | "Any">("High");
  const [topN, setTopN] = useState<number>(10);

  const p = useMemo(() => PROGRAMS.find((x) => x.key === program)!, [program]);
  const relevantClasses = useMemo(() => programClasses(program), [program]);

  // Cohort selection: by program-mapped asset classes + optional risk band + topN by risk
  const cohort = useMemo(() => {
    let list = assets.filter((a) => relevantClasses.includes(a.assetClass));
    if (band !== "Any") list = list.filter((a) => a.riskBand === band);
    list = [...list].sort((a, b) => b.risk - a.risk).slice(0, Math.max(1, topN));
    return list;
  }, [relevantClasses, band, topN]);

  const cohortStats = useMemo(() => {
    const count = cohort.length;
    const risk = cohort.reduce((s, a) => s + a.risk, 0);
    const avgRisk = count ? risk / count : 0;

    const high = cohort.filter((a) => a.riskBand === "High").length;
    const med = cohort.filter((a) => a.riskBand === "Medium").length;
    const low = cohort.filter((a) => a.riskBand === "Low").length;

    return {
      count,
      risk: Math.round(risk),
      avgRisk: Math.round(avgRisk),
      high,
      med,
      low,
    };
  }, [cohort]);

  // Program impact proxy (demo): assume a portion of cohort risk is retired
  const impact = useMemo(() => {
    const baseRisk = cohort.reduce((s, a) => s + a.risk, 0);
    const stageMultiplier = stage === "Draft" ? 0.0 : stage === "Review" ? 0.45 : 0.65;

    // By program type: vegetation & P&C tend to be more OPEX heavy; transformers more mixed
    const programMultiplier =
      program === "vegetation" ? 0.35 : program === "protection_control" ? 0.4 : program === "substations" ? 0.5 : 0.55;

    const retired = Math.round(baseRisk * stageMultiplier * programMultiplier);

    // TOTEX proxy: use a simple scale per risk point (RMk per point) by program
    const rmKPerPoint =
      program === "vegetation" ? 45 : program === "protection_control" ? 55 : program === "lines_cables" ? 70 : program === "switchgear" ? 85 : program === "substations" ? 90 : 95;

    const totexRMm = (retired * rmKPerPoint) / 1000; // (risk points * RMk) => RMm
    const capexShare =
      program === "vegetation" || program === "protection_control" ? 0.25 : program === "lines_cables" ? 0.55 : program === "switchgear" ? 0.6 : program === "substations" ? 0.6 : 0.65;

    const capex = totexRMm * capexShare;
    const opex = totexRMm - capex;

    return {
      baseRisk: Math.round(baseRisk),
      retired,
      totexRMm: Number(totexRMm.toFixed(1)),
      capexRMm: Number(capex.toFixed(1)),
      opexRMm: Number(opex.toFixed(1)),
      rmPerPoint: retired > 0 ? Number(((totexRMm * 1_000_000) / retired).toFixed(0)) : 0, // RM per point
    };
  }, [cohort, stage, program]);

  // Dependencies / readiness flags (demo)
  const dependencies = useMemo(() => {
    const needsOutage = program === "tx" || program === "switchgear" || program === "substations";
    const dataReadiness =
      program === "tx" ? "Medium–High (DGA + inspections)" : program === "vegetation" ? "Medium (ROW mapping)" : "Medium";

    const sparesLeadTime =
      program === "tx" ? "6–12 months (major components)" : program === "switchgear" ? "3–9 months (kits)" : "Low";

    return {
      needsOutage,
      dataReadiness,
      sparesLeadTime,
    };
  }, [program]);

  // Reset cohort defaults when switching program
  function setProgramAndDefaults(k: ProgramKey) {
    const def = PROGRAMS.find((x) => x.key === k)!;
    setProgram(k);
    setBand(def.defaultCohort.band);
    setTopN(def.defaultCohort.topN);
    setStage("Draft");
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--seb-navy)]">Intervention Program Builder</h1>
          <p className="text-sm text-gray-600">
            Build a <span className="font-medium">program pack</span> (scope + rationale + expected impact) — not work orders (Maximo).
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link className="underline text-[var(--seb-blue)]" href="/assets">
            Asset Intelligence
          </Link>
          <Link className="underline text-[var(--seb-blue)]" href="/capital">
            Capital Optimization – Annual Plan
          </Link>
          <Link className="underline text-[var(--seb-blue)]" href="/planning">
            5-Year Strategic Asset Plan
          </Link>
        </div>
      </div>

      {/* Program tabs */}
      <div className="rounded-xl bg-white border shadow-sm p-4">
        <div className="flex flex-wrap gap-2">
          {PROGRAMS.map((x) => {
            const active = x.key === program;
            return (
              <button
                key={x.key}
                onClick={() => setProgramAndDefaults(x.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  active ? "bg-[var(--seb-blue)] text-white" : "bg-gray-50 border hover:bg-white"
                }`}
              >
                {x.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Program summary + controls */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl bg-white border shadow-sm p-6 space-y-4">
          <div>
            <div className="font-semibold text-[var(--seb-navy)]">{p.label} Program</div>
            <div className="text-sm text-gray-600 mt-1">{p.desc}</div>
          </div>

          <div className="flex flex-wrap gap-2">
            {p.focus.map((t) => (
              <span key={t} className="text-xs px-2 py-1 rounded-full bg-gray-50 border text-gray-700">
                {t}
              </span>
            ))}
          </div>

          <div className="grid md:grid-cols-3 gap-4 pt-2">
            <div className="space-y-2">
              <div className="text-xs text-gray-500">Cohort risk band</div>
              <select
                value={band}
                onChange={(e) => setBand(e.target.value as any)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              >
                <option value="Any">Any</option>
                <option value="High">High (≥70)</option>
                <option value="Medium">Medium (45–69)</option>
                <option value="Low">Low (&lt;45)</option>
              </select>
            </div>

            <div className="space-y-2">
              <div className="text-xs text-gray-500">Top N assets (by risk)</div>
              <input
                type="number"
                min={5}
                max={30}
                step={1}
                value={topN}
                onChange={(e) => setTopN(Number(e.target.value))}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
              <div className="text-[11px] text-gray-500">Tip: 10–15 is a typical program pack size.</div>
            </div>

            <div className="space-y-2">
              <div className="text-xs text-gray-500">Governance stage</div>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as Stage)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              >
                <option value="Draft">Draft</option>
                <option value="Review">Review</option>
                <option value="Approved">Approved</option>
              </select>
              <div className="text-[11px] text-gray-500">This controls impact assumptions (demo).</div>
            </div>
          </div>

          <div className="rounded-lg bg-gray-50 border p-4 text-xs text-gray-600 space-y-2">
            <div className="font-medium text-[var(--seb-navy)]">Scope guardrails (avoids Maximo overlap)</div>
            <ul className="list-disc pl-5 space-y-1">
              <li>Outputs are program packs (scope + rationale + expected impact), not work orders.</li>
              <li>Execution remains in Maximo; APMS supports prioritization, evidence, and governance.</li>
              <li>Annual selection & budgets remain in “Capital Optimization – Annual Plan”.</li>
            </ul>
          </div>
        </div>

        {/* KPIs */}
        <div className="space-y-4">
          {kpi("Cohort size", `${cohortStats.count} assets`, "blue")}
          {kpi("Cohort risk", `${fmt(cohortStats.risk)} pts`, "amber")}
          {kpi("Avg risk", `${cohortStats.avgRisk} / 100`, "gray")}
          {kpi("Expected risk retired (proxy)", `${fmt(impact.retired)} pts`, "green")}
        </div>
      </div>

      {/* Program Pack */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Cohort table */}
        <div className="lg:col-span-2 rounded-xl bg-white border shadow-sm overflow-hidden">
          <div className="p-6 border-b flex items-start justify-between gap-4">
            <div>
              <div className="font-semibold text-[var(--seb-navy)]">Program Pack — Target Cohort</div>
              <div className="text-xs text-gray-500 mt-1">
                Cohort is selected from relevant asset classes and ranked by risk (0–100 index).
              </div>
            </div>
            <div className="text-right text-xs text-gray-600">
              {pill(`Band: ${band}`, band === "High" ? "red" : band === "Medium" ? "amber" : band === "Low" ? "green" : "gray")}
              <div className="mt-2">{pill(`Stage: ${stage}`, stage === "Approved" ? "blue" : "gray")}</div>
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
                  <th className="p-3">Recommended action</th>
                </tr>
              </thead>
              <tbody>
                {cohort.map((a) => (
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
                    <td className="p-3">{pill(a.riskBand, bandTone(a.riskBand) as any)}</td>
                    <td className="p-3">{a.recommendedAction}</td>
                  </tr>
                ))}

                {cohort.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-10 text-center text-gray-500">
                      No assets match your cohort criteria. Try band = Any.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t text-xs text-gray-500 flex items-center justify-between">
            <div>
              Showing <span className="font-medium text-gray-700">{cohort.length}</span> asset(s)
            </div>
            <div className="hidden sm:block">
              Demo note: production links cohort to evidence (measurements, inspections, event logs).
            </div>
          </div>
        </div>

        {/* Actions + economics */}
        <div className="space-y-6">
          <div className="rounded-xl bg-white border shadow-sm p-6 space-y-3">
            <div className="font-semibold text-[var(--seb-navy)]">Typical actions (template)</div>
            <div className="text-xs text-gray-500">Program playbook — not asset-by-asset work orders.</div>

            <div className="space-y-3">
              {p.typicalActions.map((a) => (
                <div key={a.label} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-medium text-sm text-[var(--seb-navy)]">{a.label}</div>
                    {pill(a.type, a.type === "OPEX" ? "green" : a.type === "CAPEX" ? "blue" : "gray")}
                  </div>
                  <div className="text-xs text-gray-600 mt-2">{a.notes}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-white border shadow-sm p-6 space-y-3">
            <div className="font-semibold text-[var(--seb-navy)]">Impact & funding (portfolio proxy)</div>
            <div className="text-xs text-gray-500">
              Used for program-level planning, not approval of individual interventions.
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="rounded-lg border p-4">
                <div className="text-xs text-gray-500">Risk retired</div>
                <div className="mt-1 text-lg font-semibold text-[var(--seb-green)]">{fmt(impact.retired)} pts</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-xs text-gray-500">TOTEX (proxy)</div>
                <div className="mt-1 text-lg font-semibold text-[var(--seb-navy)]">RM {impact.totexRMm}m</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-xs text-gray-500">CAPEX</div>
                <div className="mt-1 text-sm font-semibold text-[var(--seb-navy)]">RM {impact.capexRMm}m</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-xs text-gray-500">OPEX</div>
                <div className="mt-1 text-sm font-semibold text-[var(--seb-navy)]">RM {impact.opexRMm}m</div>
              </div>
            </div>

            <div className="rounded-lg bg-gray-50 border p-4 text-xs text-gray-600">
              <div className="font-medium text-[var(--seb-navy)]">How to read (demo)</div>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>Risk retired is a proxy derived from cohort risk and stage.</li>
                <li>TOTEX is a planning envelope (not a contract or work order cost).</li>
                <li>In production, this uses calibrated risk-to-RM models and outage impact monetization.</li>
              </ul>
            </div>
          </div>

          <div className="rounded-xl bg-white border shadow-sm p-6 space-y-3">
            <div className="font-semibold text-[var(--seb-navy)]">Dependencies & readiness</div>
            <div className="flex flex-wrap gap-2">
              {dependencies.needsOutage ? pill("Requires outage window", "amber") : pill("No outage dependency", "green")}
              {pill(`Data readiness: ${dependencies.dataReadiness}`, "gray")}
              {pill(`Spares lead time: ${dependencies.sparesLeadTime}`, "gray")}
            </div>

            <div className="text-xs text-gray-500">
              Next step (demo roadmap): add “readiness scoring” from data coverage, condition history, and spares availability.
            </div>
          </div>

          <div className="rounded-xl bg-white border shadow-sm p-6 space-y-3">
            <div className="font-semibold text-[var(--seb-navy)]">Outputs</div>
            <div className="text-xs text-gray-600">
              Export is a placeholder in this demo. In production, generate a PDF-ready pack for AM/Finance review.
            </div>

            <button
              onClick={() => alert("Demo: Export pack (PDF) would be generated here.")}
              className="w-full rounded-lg bg-[var(--seb-blue)] text-white py-2 text-sm font-medium hover:opacity-95"
            >
              Export program pack (demo)
            </button>

            <button
              onClick={() => alert("Demo: Create review workflow would be triggered here.")}
              className="w-full rounded-lg border py-2 text-sm font-medium hover:bg-gray-50"
            >
              Send to review (demo)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}