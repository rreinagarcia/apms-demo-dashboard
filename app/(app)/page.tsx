"use client";

import Link from "next/link";

function StatusDot({ status }: { status: "green" | "yellow" | "red" }) {
  const color =
    status === "green"
      ? "bg-emerald-500"
      : status === "yellow"
      ? "bg-amber-400"
      : "bg-red-500";

  return <span className={`inline-block w-2.5 h-2.5 rounded-full mr-2 ${color}`} />;
}

function ModuleCard({
  title,
  description,
  href,
  status,
}: {
  title: string;
  description: string;
  href: string;
  status: "green" | "yellow" | "red";
}) {
  return (
    <Link
      href={href}
      className="rounded-xl bg-white border shadow-sm p-6 hover:shadow-md transition block"
    >
      <div className="font-semibold text-[var(--seb-navy)] flex items-center">
        <StatusDot status={status} />
        {title}
      </div>
      <div className="text-sm text-gray-600 mt-2">{description}</div>
    </Link>
  );
}

export default function PortfolioOverviewPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-[var(--seb-navy)]">
          Portfolio Overview
        </h1>
        <p className="text-sm text-gray-600 mt-2">
          Enterprise-level risk and capital planning dashboard. Modules below represent the core capability stack.
        </p>
      </div>

      {/* Executive Section */}
      <div className="space-y-4">
        <div className="text-[11px] text-gray-400 uppercase tracking-wide">
          Executive
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <ModuleCard
            title="Portfolio Analytics"
            description="Fleet-level risk distribution, concentration analysis, and executive signals."
            href="/analytics"
            status="green"
          />

          <ModuleCard
            title="Capital Optimization – Annual Plan"
            description="Annual budget allocation and intervention prioritization based on risk reduction."
            href="/capital"
            status="green"
          />

          <ModuleCard
            title="5-Year Strategic Asset Plan"
            description="Scenario-based portfolio trajectory with risk and financial exposure."
            href="/planning"
            status="yellow"
          />
        </div>
      </div>

      {/* Operations Section */}
      <div className="space-y-4">
        <div className="text-[11px] text-gray-400 uppercase tracking-wide">
          Operations
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <ModuleCard
            title="Asset Intelligence"
            description="Asset-level health, criticality, and risk index visualization."
            href="/assets"
            status="green"
          />

          <ModuleCard
            title="Intervention Program Builder"
            description="Structured program design and budget scenario testing."
            href="/programs"
            status="yellow"
          />

          <ModuleCard
            title="Data & Model Health"
            description="Data coverage, model maturity, and calibration transparency."
            href="/data-health"
            status="yellow"
          />
        </div>
      </div>

      {/* Predictive Section */}
      <div className="space-y-4">
        <div className="text-[11px] text-gray-400 uppercase tracking-wide">
          Predictive Modules
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <ModuleCard
            title="Probability of Failure Forecast"
            description="Horizon-based PoF modeling with financial exposure estimation."
            href="/predictive/pof"
            status="red"
          />

          <ModuleCard
            title="RUL & End-of-Life Planning"
            description="Remaining useful life modeling and replacement wave planning."
            href="/predictive/rul"
            status="red"
          />

          <ModuleCard
            title="Trend Anomaly Detection"
            description="Condition monitoring alerts with indicator drift detection."
            href="/predictive/anomalies"
            status="red"
          />

          <ModuleCard
            title="Prescriptive Actions"
            description="Constraint-aware intervention optimization and decision support."
            href="/predictive/prescriptive"
            status="red"
          />
        </div>
      </div>

      {/* Footer Note */}
      <div className="rounded-xl border bg-white shadow-sm p-6 text-xs text-gray-600">
        <div className="font-semibold text-[var(--seb-navy)] mb-2">
          Demo Scope Clarification
        </div>
        <ul className="list-disc pl-5 space-y-1">
          <li>Risk index is shown as 0–100 aggregated fleet proxy.</li>
          <li>Financial values represent illustrative RM exposure estimates.</li>
          <li>Execution workflows remain within Maximo and existing enterprise systems.</li>
        </ul>
      </div>
    </div>
  );
}