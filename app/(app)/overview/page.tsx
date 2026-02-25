"use client";

import Link from "next/link";

function StatusDot({ status }: { status: "green" | "yellow" | "red" }) {
  const color =
    status === "green"
      ? "bg-emerald-500"
      : status === "yellow"
      ? "bg-amber-400"
      : "bg-red-500";
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />;
}

function Card({
  title,
  desc,
  href,
  status,
}: {
  title: string;
  desc: string;
  href: string;
  status: "green" | "yellow" | "red";
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl bg-white border shadow-sm p-6 hover:shadow-md transition"
    >
      <div className="flex items-center gap-2">
        <StatusDot status={status} />
        <div className="font-semibold text-[var(--seb-navy)]">{title}</div>
      </div>
      <div className="mt-2 text-sm text-gray-600">{desc}</div>
    </Link>
  );
}

export default function OverviewPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-[var(--seb-navy)]">
          Platform Overview
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Demo environment for SEB’s Asset Performance Management System (APMS).
          Use the tiles below to navigate the capability stack.
        </p>
      </div>

      {/* Executive */}
      <div className="space-y-3">
        <div className="text-[11px] text-gray-400 uppercase tracking-wide">
          Executive
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <Card
            title="Portfolio Analytics"
            desc="Risk distribution, concentration analysis, and executive signals."
            href="/analytics"
            status="green"
          />
          <Card
            title="Capital Optimization – Annual Plan"
            desc="Annual CAPEX/OPEX envelopes and intervention prioritization (demo)."
            href="/capital"
            status="green"
          />
          <Card
            title="5-Year Strategic Asset Plan"
            desc="Scenario trajectory (2025–2029) with risk + exposure view (demo)."
            href="/planning"
            status="yellow"
          />
        </div>
      </div>

      {/* Operations */}
      <div className="space-y-3">
        <div className="text-[11px] text-gray-400 uppercase tracking-wide">
          Operations
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <Card
            title="Asset Intelligence"
            desc="Fleet table, filters, and drill-down into asset detail pages."
            href="/assets"
            status="green"
          />
          <Card
            title="Intervention Program Builder"
            desc="Program design and scenario testing (kept out of Maximo execution)."
            href="/programs"
            status="yellow"
          />
          <Card
            title="Data & Model Health"
            desc="Coverage, freshness, and model maturity transparency."
            href="/data-health"
            status="yellow"
          />
        </div>
      </div>

      {/* Predictive (future) */}
      <div className="space-y-3">
        <div className="text-[11px] text-gray-400 uppercase tracking-wide">
          Predictive Modules
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <Card
            title="Predictive Analytics Hub"
            desc="Entry point for future predictive modules."
            href="/predictive"
            status="red"
          />
          <Card
            title="PoF Forecast"
            desc="Horizon-based PoF with exposure estimation (demo)."
            href="/predictive/pof"
            status="red"
          />
          <Card
            title="RUL & EoL Planning"
            desc="P50/P90 RUL and replacement wave planning (demo)."
            href="/predictive/rul"
            status="red"
          />
          <Card
            title="Anomaly Detection"
            desc="Trend drift alerts and indicator evidence (demo)."
            href="/predictive/anomalies"
            status="red"
          />
        </div>
      </div>

      {/* Notes */}
      <div className="rounded-xl bg-white border shadow-sm p-6 text-xs text-gray-600 space-y-2">
        <div className="font-semibold text-[var(--seb-navy)]">
          Demo scope guardrails
        </div>
        <ul className="list-disc pl-5 space-y-1">
          <li>Risk is shown as a 0–100 index (planning proxy), not RM.</li>
          <li>Predictive modules are shown as future capabilities (not in Phase 1 demo scope).</li>
          <li>Execution workflows remain in Maximo; APMS supports prioritization and planning.</li>
        </ul>
      </div>
    </div>
  );
}