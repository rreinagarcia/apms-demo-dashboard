"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { assets } from "@/lib/mock";
import {
  type Horizon,
  expectedExposureRMm,
  interventionOptions,
  type InterventionOption,
} from "@/lib/analytics";

type OutageConstraint = "none" | "plannedOnly" | "noOutageWindow";
type SparesConstraint = "available" | "limited" | "backordered";

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
        {subtitle ? (
          <div className="text-xs text-gray-500 mt-1">{subtitle}</div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function pill(text: string, tone: "blue" | "green" | "amber" | "gray") {
  const cls =
    tone === "green"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "blue"
      ? "border-blue-200 bg-blue-50 text-blue-800"
      : tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-gray-200 bg-gray-50 text-gray-700";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${cls}`}
    >
      {text}
    </span>
  );
}

function fmtRMm(x: number) {
  return `RM ${x.toFixed(1)}m`;
}

function scorebar(valuePct: number) {
  const v = Math.max(0, Math.min(100, valuePct));
  return (
    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
      <div
        className="h-full bg-[var(--seb-blue)]"
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

function applyConstraints(
  opt: InterventionOption,
  outage: OutageConstraint,
  spares: SparesConstraint
) {
  // Copy so we can “adjust” for demo without mutating source
  let allowed = true;
  let note: string | null = null;

  // OUTAGE constraint logic (simple, believable)
  // - noOutageWindow: block interventions requiring outages (we assume CAPEX always needs outage, OPEX sometimes)
  // - plannedOnly: allow but increase lead-time (coordination)
  if (outage === "noOutageWindow") {
    if (opt.type === "CAPEX") {
      allowed = false;
      note = "Blocked: outage window not available for CAPEX work.";
    }
    if (opt.type === "OPEX" && opt.action.toLowerCase().includes("work pack")) {
      // assume some OPEX still needs switching/clearance
      // keep allowed but penalize effectiveness slightly
      note = "Constraint: limited outage windows → reduced effectiveness.";
    }
  } else if (outage === "plannedOnly") {
    // keep allowed but slightly longer lead time and slightly reduced effectiveness
    note = "Constraint: planned outages only → longer lead time.";
  }

  // SPARES constraint logic
  // - backordered: CAPEX blocked (major parts), OPEX allowed with reduced effectiveness
  // - limited: allow but reduce effectiveness a bit and increase lead time
  if (spares === "backordered") {
    if (opt.type === "CAPEX") {
      allowed = false;
      note = "Blocked: critical spares backordered for CAPEX intervention.";
    } else {
      note = "Constraint: spares backordered → reduced effectiveness.";
    }
  } else if (spares === "limited") {
    note = note
      ? `${note} (Spares limited → minor effectiveness reduction.)`
      : "Constraint: spares limited → minor effectiveness reduction.";
  }

  // Apply small “demo penalties” to multiplier/lead time when constrained
  let pofMultiplier = opt.pofMultiplier;
  let leadTimeMonths = opt.leadTimeMonths;

  if (outage === "plannedOnly") {
    leadTimeMonths += 2;
    pofMultiplier = Math.min(0.95, pofMultiplier + 0.05);
  }
  if (outage === "noOutageWindow" && allowed && opt.type === "OPEX") {
    pofMultiplier = Math.min(0.98, pofMultiplier + 0.08);
  }

  if (spares === "limited") {
    leadTimeMonths += 1;
    pofMultiplier = Math.min(0.98, pofMultiplier + 0.04);
  }
  if (spares === "backordered" && allowed && opt.type === "OPEX") {
    leadTimeMonths += 2;
    pofMultiplier = Math.min(0.99, pofMultiplier + 0.07);
  }

  return { allowed, note, pofMultiplier, leadTimeMonths };
}

export default function PrescriptiveActionsPage() {
  const [horizon, setHorizon] = useState<Horizon>("12m");

  // ✅ Split constraints into two independent dropdowns
  const [outageConstraint, setOutageConstraint] =
    useState<OutageConstraint>("plannedOnly");
  const [sparesConstraint, setSparesConstraint] =
    useState<SparesConstraint>("limited");

  const rows = useMemo(() => {
    // Build intervention rows per asset, apply constraints, then rank by “benefit”
    const all = assets.flatMap((a) => {
      const baseExposure = expectedExposureRMm(a, horizon);
      const opts = interventionOptions(a);

      return opts.map((opt) => {
        const adj = applyConstraints(opt, outageConstraint, sparesConstraint);

        const afterExposure = Number((baseExposure * adj.pofMultiplier).toFixed(1));
        const exposureReduction = Number((baseExposure - afterExposure).toFixed(1));
        const roi = opt.costRMm > 0 ? exposureReduction / opt.costRMm : 0;

        return {
          asset: a,
          opt,
          allowed: adj.allowed,
          note: adj.note,
          adjMultiplier: adj.pofMultiplier,
          adjLeadTime: adj.leadTimeMonths,
          baseExposure,
          afterExposure,
          exposureReduction,
          roi,
        };
      });
    });

    // Rank: allowed first, then biggest exposure reduction, then ROI
    all.sort((x, y) => {
      if (x.allowed !== y.allowed) return x.allowed ? -1 : 1;
      if (y.exposureReduction !== x.exposureReduction)
        return y.exposureReduction - x.exposureReduction;
      return y.roi - x.roi;
    });

    return all;
  }, [horizon, outageConstraint, sparesConstraint]);

  const kpis = useMemo(() => {
    const allowed = rows.filter((r) => r.allowed);
    const totalBase = allowed.reduce((s, r) => s + r.baseExposure, 0);
    const totalAfter = allowed.reduce((s, r) => s + r.afterExposure, 0);
    const totalRed = totalBase - totalAfter;

    return {
      allowedCount: allowed.length,
      blockedCount: rows.length - allowed.length,
      totalBase: Number(totalBase.toFixed(1)),
      totalAfter: Number(totalAfter.toFixed(1)),
      totalRed: Number(totalRed.toFixed(1)),
    };
  }, [rows]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--seb-navy)]">
            Prescriptive Actions (Demo)
          </h1>
          <p className="text-sm text-gray-600">
            Turns predictive exposure into recommended interventions, filtered by
            operational constraints (no Maximo overlap).
          </p>
        </div>
        <Link
          href="/predictive/pof"
          className="text-sm underline text-[var(--seb-blue)]"
        >
          Back to PoF & Exposure
        </Link>
      </div>

      {/* Controls */}
      <Card
        title="Planning controls"
        subtitle="Separate constraint controls: outages vs spares."
      >
        <div className="grid md:grid-cols-3 gap-4">
          {/* Horizon */}
          <div className="space-y-2">
            <div className="text-xs text-gray-500">Horizon</div>
            <select
              value={horizon}
              onChange={(e) => setHorizon(e.target.value as Horizon)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            >
              <option value="3m">3 months</option>
              <option value="6m">6 months</option>
              <option value="12m">12 months</option>
              <option value="24m">24 months</option>
            </select>
          </div>

          {/* ✅ Outage constraints */}
          <div className="space-y-2">
            <div className="text-xs text-gray-500">Outage constraints</div>
            <select
              value={outageConstraint}
              onChange={(e) =>
                setOutageConstraint(e.target.value as OutageConstraint)
              }
              className="w-full rounded-lg border px-3 py-2 text-sm"
            >
              <option value="none">None</option>
              <option value="plannedOnly">Planned outages only</option>
              <option value="noOutageWindow">No outage window available</option>
            </select>
            <div className="text-[11px] text-gray-500">
              Filters interventions requiring switching / planned clearances.
            </div>
          </div>

          {/* ✅ Spares constraints */}
          <div className="space-y-2">
            <div className="text-xs text-gray-500">Spares constraints</div>
            <select
              value={sparesConstraint}
              onChange={(e) =>
                setSparesConstraint(e.target.value as SparesConstraint)
              }
              className="w-full rounded-lg border px-3 py-2 text-sm"
            >
              <option value="available">Spares available</option>
              <option value="limited">Spares limited</option>
              <option value="backordered">Backordered / long lead</option>
            </select>
            <div className="text-[11px] text-gray-500">
              Simulates supply chain/warehouse limitations.
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {pill(`Horizon: ${horizon}`, "gray")}
          {pill(
            `Outages: ${
              outageConstraint === "none"
                ? "None"
                : outageConstraint === "plannedOnly"
                ? "Planned-only"
                : "No window"
            }`,
            "blue"
          )}
          {pill(
            `Spares: ${
              sparesConstraint === "available"
                ? "Available"
                : sparesConstraint === "limited"
                ? "Limited"
                : "Backordered"
            }`,
            "green"
          )}
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid md:grid-cols-5 gap-5">
        <div className="rounded-xl bg-white border shadow-sm p-5">
          <div className="text-xs text-gray-500 uppercase tracking-wide">
            Options allowed
          </div>
          <div className="mt-1 text-2xl font-semibold text-[var(--seb-navy)]">
            {kpis.allowedCount}
          </div>
        </div>
        <div className="rounded-xl bg-white border shadow-sm p-5">
          <div className="text-xs text-gray-500 uppercase tracking-wide">
            Options blocked
          </div>
          <div className="mt-1 text-2xl font-semibold text-[var(--seb-navy)]">
            {kpis.blockedCount}
          </div>
        </div>
        <div className="rounded-xl bg-white border shadow-sm p-5">
          <div className="text-xs text-gray-500 uppercase tracking-wide">
            Exposure (before)
          </div>
          <div className="mt-1 text-2xl font-semibold text-[var(--seb-navy)]">
            {fmtRMm(kpis.totalBase)}
          </div>
        </div>
        <div className="rounded-xl bg-white border shadow-sm p-5">
          <div className="text-xs text-gray-500 uppercase tracking-wide">
            Exposure (after)
          </div>
          <div className="mt-1 text-2xl font-semibold text-[var(--seb-navy)]">
            {fmtRMm(kpis.totalAfter)}
          </div>
        </div>
        <div className="rounded-xl bg-white border shadow-sm p-5">
          <div className="text-xs text-gray-500 uppercase tracking-wide">
            Exposure reduced
          </div>
          <div className="mt-1 text-2xl font-semibold text-[var(--seb-green)]">
            {fmtRMm(kpis.totalRed)}
          </div>
        </div>
      </div>

      {/* Table */}
      <Card
        title="Recommended interventions (ranked)"
        subtitle="Ranked by exposure reduction (RM m), then ROI. Blocked items appear at the bottom."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="p-3">Asset</th>
                <th className="p-3">Type</th>
                <th className="p-3">Action</th>
                <th className="p-3">Lead time</th>
                <th className="p-3">Cost (RM m)</th>
                <th className="p-3">Exposure ↓ (RM m)</th>
                <th className="p-3">ROI</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 30).map((r) => {
                const status = r.allowed
                  ? pill("Allowed", "green")
                  : pill("Blocked", "amber");

                const typePill =
                  r.opt.type === "CAPEX"
                    ? pill("CAPEX", "blue")
                    : pill("OPEX", "green");

                const roiPct = Math.max(0, Math.min(100, r.roi * 25)); // just for bar visual
                return (
                  <tr
                    key={`${r.asset.id}-${r.opt.type}`}
                    className={`border-t hover:bg-gray-50 ${
                      r.allowed ? "" : "opacity-70"
                    }`}
                    title={
                      r.note
                        ? `${r.asset.id}: ${r.note}`
                        : `${r.asset.id}: no blocking constraints`
                    }
                  >
                    <td className="p-3 font-medium">
                      <Link className="underline" href={`/assets/item/${r.asset.id}`}>
                        {r.asset.id}
                      </Link>
                      <div className="text-xs text-gray-500">
                        {r.asset.assetClass} · {r.asset.region}
                      </div>
                    </td>
                    <td className="p-3">{typePill}</td>
                    <td className="p-3">{r.opt.action}</td>
                    <td className="p-3">
                      {r.adjLeadTime} mo
                      <div className="text-xs text-gray-500">
                        conf: {r.opt.confidence}
                      </div>
                    </td>
                    <td className="p-3">{r.opt.costRMm.toFixed(1)}</td>
                    <td className="p-3 font-semibold text-[var(--seb-navy)]">
                      {r.exposureReduction.toFixed(1)}
                      <div className="mt-1">{scorebar(roiPct)}</div>
                    </td>
                    <td className="p-3">{r.roi.toFixed(2)}</td>
                    <td className="p-3">
                      {status}
                      {r.note ? (
                        <div className="text-xs text-gray-500 mt-1">{r.note}</div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 rounded-lg bg-gray-50 p-4 text-xs text-gray-600">
          <div className="font-medium text-[var(--seb-navy)] mb-1">
            Notes (demo)
          </div>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              “Exposure” is an expected value proxy: PoF index (0–100) × failure
              cost (RM m).
            </li>
            <li>
              Outage and spares constraints can block CAPEX options or reduce
              effectiveness/extend lead times.
            </li>
            <li>
              Clicking an asset opens the Asset Detail page (deep dive) — no work
              order execution overlap with Maximo.
            </li>
          </ul>
        </div>
      </Card>
    </div>
  );
}