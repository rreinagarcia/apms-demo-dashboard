"use client";

import Link from "next/link";
import { useMemo } from "react";
import { assets } from "@/lib/mock";

type ReportItem = {
  id: string;
  title: string;
  desc: string;
  format: "PDF" | "XLSX" | "CSV" | "PPTX";
  audience: "Executive" | "Engineering" | "Planning" | "Operations";
  updated: string; // demo
  tags: string[];
};

function pill(text: string, tone: "blue" | "green" | "amber" | "gray") {
  const cls =
    tone === "green"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : tone === "blue"
      ? "border-blue-200 bg-blue-50 text-blue-800"
      : "border-gray-200 bg-gray-50 text-gray-700";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${cls}`}>
      {text}
    </span>
  );
}

function downloadText(filename: string, content: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function assetsCsv() {
  const headers = [
    "assetId",
    "name",
    "assetClass",
    "region",
    "healthIndex_0_100",
    "criticalityIndex_0_100",
    "riskIndex_0_100",
    "riskBand",
    "recommendedAction",
  ];
  const rows = assets.map((a) => [
    a.id,
    a.name,
    a.assetClass,
    a.region,
    a.health,
    a.criticality,
    a.risk,
    a.riskBand,
    a.recommendedAction,
  ]);
  return [headers, ...rows]
    .map((r) => r.map((x) => `"${String(x ?? "").replaceAll(`"`, `""`)}"`).join(","))
    .join("\n");
}

function scenarioSummaryCsv() {
  // lightweight “outputs” for demo; aligns to your 5-year planning narrative
  const baselineFleetRisk = Math.round(assets.reduce((s, a) => s + a.risk, 0));
  const highRisk = assets.filter((a) => a.riskBand === "High").length;

  const scenarios = [
    { name: "Base Plan", retirePct: 0.14, totexRMm: 420 },
    { name: "Budget Constrained", retirePct: 0.10, totexRMm: 300 },
    { name: "Reliability Accelerated", retirePct: 0.21, totexRMm: 620 },
  ];

  const headers = [
    "scenario",
    "fleetRisk_2025_pts",
    "fleetRisk_2029_pts",
    "riskRetired_pts",
    "riskRetired_pct",
    "highRiskAssets_2025",
    "totex_estimate_RMm",
  ];

  const rows = scenarios.map((s) => {
    const end = Math.max(0, Math.round(baselineFleetRisk * (1 - s.retirePct)));
    const retired = baselineFleetRisk - end;
    const pct = baselineFleetRisk > 0 ? (retired / baselineFleetRisk) * 100 : 0;
    return [s.name, baselineFleetRisk, end, retired, pct.toFixed(1), highRisk, s.totexRMm];
  });

  return [headers, ...rows]
    .map((r) => r.map((x) => `"${String(x ?? "").replaceAll(`"`, `""`)}"`).join(","))
    .join("\n");
}

export default function ReportsPage() {
  const reports = useMemo<ReportItem[]>(
    () => [
      {
        id: "RPT-EXEC-001",
        title: "Executive Summary Pack (Monthly)",
        desc: "Portfolio risk movement, hot assets, budget signals, and scenario deltas for leadership.",
        format: "PPTX",
        audience: "Executive",
        updated: "Today 09:10",
        tags: ["Portfolio", "Risk", "Board-ready"],
      },
      {
        id: "RPT-PLAN-002",
        title: "5-Year Strategic Asset Plan – Scenario Workbook",
        desc: "Scenario assumptions, risk trajectory, and exposure proxies (planning-level, not work orders).",
        format: "XLSX",
        audience: "Planning",
        updated: "Today 09:10",
        tags: ["Scenario", "Totex", "Planning"],
      },
      {
        id: "RPT-ENG-003",
        title: "High-Risk Asset Evidence Pack",
        desc: "Top-risk assets with drivers, predictive signals, and recommended intervention types.",
        format: "PDF",
        audience: "Engineering",
        updated: "Yesterday 18:40",
        tags: ["Evidence", "Drivers", "Diagnostics"],
      },
      {
        id: "RPT-OPS-004",
        title: "Maintenance Program Register (Advisory)",
        desc: "Program packs by asset class and region; aligned to constraints (outage windows/spares readiness).",
        format: "XLSX",
        audience: "Operations",
        updated: "Yesterday 18:40",
        tags: ["Programs", "Constraints", "Readiness"],
      },
      {
        id: "RPT-DATA-005",
        title: "Asset Register Extract (Demo CSV)",
        desc: "Download the demo asset table used by the dashboard (for quick charting).",
        format: "CSV",
        audience: "Planning",
        updated: "Now",
        tags: ["Data", "Export"],
      },
      {
        id: "RPT-PLAN-006",
        title: "Scenario Comparison Table (Demo CSV)",
        desc: "Side-by-side scenario outcomes incl. indicative Totex to achieve risk retirement.",
        format: "CSV",
        audience: "Executive",
        updated: "Now",
        tags: ["Scenario", "Totex", "Comparison"],
      },
    ],
    []
  );

  function toneForAudience(a: ReportItem["audience"]) {
    if (a === "Executive") return "blue";
    if (a === "Planning") return "amber";
    if (a === "Engineering") return "green";
    return "gray";
  }

  function onDownload(r: ReportItem) {
    // For demo: generate downloadable CSVs; show “stub” for others.
    if (r.id === "RPT-DATA-005") {
      downloadText("SEB_APMS_demo_asset_register.csv", assetsCsv(), "text/csv;charset=utf-8");
      return;
    }
    if (r.id === "RPT-PLAN-006") {
      downloadText("SEB_APMS_demo_scenario_comparison.csv", scenarioSummaryCsv(), "text/csv;charset=utf-8");
      return;
    }

    // stub: generate a tiny text file so the button does something in demo
    const content = [
      `${r.title}`,
      `Format: ${r.format}`,
      `Audience: ${r.audience}`,
      `Updated: ${r.updated}`,
      ``,
      `Demo note: In production, this would download a generated file (PDF/XLSX/PPTX)`,
      `assembled from the latest asset evidence + analytics outputs.`,
    ].join("\n");
    downloadText(`${r.id}_${r.title.replaceAll(" ", "_")}.txt`, content);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--seb-navy)]">Reports & Downloads</h1>
          <p className="text-sm text-gray-600">
            Exportable packs designed for <span className="font-medium">decision support</span> (not Maximo execution).
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link className="underline text-[var(--seb-blue)]" href="/portfolio">
            Portfolio Overview
          </Link>
          <Link className="underline text-[var(--seb-blue)]" href="/analytics">
            Portfolio Analytics
          </Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl bg-white border shadow-sm overflow-hidden">
          <div className="p-6 border-b">
            <div className="font-semibold text-[var(--seb-navy)]">Available packs</div>
            <div className="text-xs text-gray-500 mt-1">
              Demo: CSVs are real downloads; other formats are stubs (still clickable).
            </div>
          </div>

          <div className="divide-y">
            {reports.map((r) => (
              <div key={r.id} className="p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-semibold text-[var(--seb-navy)]">{r.title}</div>
                    {pill(r.audience, toneForAudience(r.audience))}
                    {pill(r.format, "gray")}
                  </div>
                  <div className="mt-1 text-sm text-gray-700">{r.desc}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {r.tags.map((t) => (
                      <span key={t} className="text-xs text-gray-500">
                        • {t}
                      </span>
                    ))}
                    <span className="text-xs text-gray-400">· Updated: {r.updated}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onDownload(r)}
                    className="rounded-lg bg-[var(--seb-blue)] text-white px-4 py-2 text-sm font-medium hover:opacity-95"
                  >
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 border-t text-xs text-gray-500">
            Guardrail: Reports summarize insights + recommended programs; they do not create or manage work orders in Maximo.
          </div>
        </div>

        <div className="rounded-xl bg-white border shadow-sm p-6 space-y-4">
          <div className="font-semibold text-[var(--seb-navy)]">How these are used</div>
          <ul className="list-disc pl-5 text-sm text-gray-700 space-y-2">
            <li>
              <span className="font-medium">Executive:</span> portfolio signals, scenario deltas, funding discussions.
            </li>
            <li>
              <span className="font-medium">Planning:</span> multi-year risk retirement, exposure proxies, cohort programs.
            </li>
            <li>
              <span className="font-medium">Engineering:</span> evidence packs, drivers, recommended diagnostics.
            </li>
            <li>
              <span className="font-medium">Operations:</span> program registers to coordinate outage/spares readiness.
            </li>
          </ul>

          <div className="rounded-lg bg-gray-50 p-4 text-xs text-gray-600">
            Demo idea: when SEB asks “show me something tangible,” you can download the CSVs and drop them into Excel
            to build quick charts during the meeting.
          </div>
        </div>
      </div>
    </div>
  );
}