"use client";

import Link from "next/link";
import { useMemo } from "react";
import { assets } from "@/lib/mock";

function Card({
  title,
  subtitle,
  children,
  href,
}: {
  title: string;
  subtitle: string;
  children?: React.ReactNode;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl bg-white border shadow-sm p-6 hover:shadow-md transition"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-[var(--seb-navy)]">{title}</div>
          <div className="text-sm text-gray-600 mt-1">{subtitle}</div>
        </div>
        <span className="rounded-full border bg-gray-50 px-2 py-0.5 text-xs text-gray-700">
          Phase 2+
        </span>
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </Link>
  );
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white border shadow-sm p-5">
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-[var(--seb-navy)]">{value}</div>
    </div>
  );
}

export default function PredictiveHubPage() {
  const fleet = useMemo(() => {
    const n = assets.length || 1;
    const avgHealth = Math.round(assets.reduce((s, a) => s + a.health, 0) / n);
    const avgRisk = Math.round(assets.reduce((s, a) => s + a.risk, 0) / n);
    const high = assets.filter((a) => a.riskBand === "High").length;
    return { n, avgHealth, avgRisk, high };
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--seb-navy)]">Predictive Analytics (Phase 2+)</h1>
          <p className="text-sm text-gray-600">
            Forward-looking modules (demo). Outputs link back to evidence and avoid work-order overlap (Maximo).
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link className="underline text-[var(--seb-blue)]" href="/data-health">
            Data & Model Health
          </Link>
          <Link className="underline text-[var(--seb-blue)]" href="/assets">
            Asset Intelligence
          </Link>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-5">
        <KPI label="Assets in demo" value={`${fleet.n}`} />
        <KPI label="Avg Health" value={`${fleet.avgHealth} / 100`} />
        <KPI label="Avg Risk" value={`${fleet.avgRisk} / 100`} />
        <KPI label="High-risk assets" value={`${fleet.high}`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card
          title="PoF Forecast"
          subtitle="Probability-of-failure outlook for next 3/6/12/24 months (index)."
          href="/predictive/pof"
        >
          <div className="text-xs text-gray-600">
            What you’ll show: PoF bands, dominant failure mode, confidence, “top movers”.
          </div>
        </Card>

        <Card
          title="RUL & End-of-Life Planning"
          subtitle="P50/P90 RUL and component driver; repair vs replace decision support."
          href="/predictive/rul"
        >
          <div className="text-xs text-gray-600">
            What you’ll show: cohort waves by year + asset drill-down with drivers.
          </div>
        </Card>

        <Card
          title="Anomaly Detection"
          subtitle="Indicator trends, anomaly score, and ‘what changed’ explanation."
          href="/predictive/anomalies"
        >
          <div className="text-xs text-gray-600">
            What you’ll show: alert inbox + trend sparkline panels (demo).
          </div>
        </Card>

        <Card
          title="Prescriptive Actions"
          subtitle="Action ranking under constraints (outage, spares, readiness) with expected impact."
          href="/predictive/prescriptive"
        >
          <div className="text-xs text-gray-600">
            What you’ll show: recommended actions with evidence + program pack tie-in.
          </div>
        </Card>
      </div>

      <div className="rounded-xl bg-white border shadow-sm p-6 text-xs text-gray-600">
        <div className="font-semibold text-[var(--seb-navy)] mb-2">Important (demo boundary)</div>
        <ul className="list-disc pl-5 space-y-1">
          <li>All predictive outputs are illustrative and shown as indices (0–100), not RM.</li>
          <li>Execution stays in Maximo; APMS provides prioritization, evidence, and governance signals.</li>
          <li>Calibration uses SEB failure history and SME validation (see “Data & Model Health”).</li>
        </ul>
      </div>
    </div>
  );
}