"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { assets as allAssets, type Asset } from "@/lib/mock";

type SortKey = "risk" | "health" | "criticality" | "id" | "region" | "assetClass";
type SortDir = "asc" | "desc";

const assetClasses = [
  { label: "All Classes", value: "ALL" },
  { label: "Power Transformer", value: "Power Transformer" },
  { label: "Distribution Transformer", value: "Distribution Transformer" },
  { label: "Switchgear (GIS/AIS)", value: "Switchgear (GIS/AIS)" },
  { label: "Circuit Breaker", value: "Circuit Breaker" },
  { label: "Overhead Line", value: "Overhead Line" },
  { label: "Underground Cable", value: "Underground Cable" },
  { label: "Substation", value: "Substation" },
  { label: "Protection & Control", value: "Protection & Control" },
  { label: "Vegetation Zone", value: "Vegetation Zone" },
];

const riskBands = [
  { label: "All", value: "ALL" },
  { label: "High", value: "High" },
  { label: "Medium", value: "Medium" },
  { label: "Low", value: "Low" },
];

function bandPill(band: Asset["riskBand"]) {
  const cls =
    band === "High"
      ? "border-red-200 bg-red-50 text-red-800"
      : band === "Medium"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-emerald-200 bg-emerald-50 text-emerald-800";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${cls}`}>
      {band}
    </span>
  );
}

function scoreChip(label: string, value: number, emphasis?: boolean) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-sm ${emphasis ? "font-semibold text-[var(--seb-navy)]" : "text-gray-800"}`}>
        {value}
      </div>
    </div>
  );
}

function kpiCard(label: string, value: string, accent?: "blue" | "green" | "gray") {
  const border =
    accent === "green"
      ? "border-[var(--seb-green)]"
      : accent === "gray"
      ? "border-gray-200"
      : "border-[var(--seb-blue)]";

  return (
    <div className={`rounded-xl bg-white p-5 shadow-sm border-l-4 ${border}`}>
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-[var(--seb-navy)]">{value}</div>
    </div>
  );
}

function sortAssets(items: Asset[], key: SortKey, dir: SortDir) {
  const factor = dir === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    const av = a[key] as any;
    const bv = b[key] as any;

    if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
    return String(av).localeCompare(String(bv)) * factor;
  });
}

export default function AssetIntelligencePage() {
  const [selectedClass, setSelectedClass] = useState<string>("ALL");
  const [selectedBand, setSelectedBand] = useState<string>("ALL");
  const [selectedRegion, setSelectedRegion] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");

  const [sortKey, setSortKey] = useState<SortKey>("risk");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const regions = useMemo(() => {
    const unique = Array.from(new Set(allAssets.map((a) => a.region))).sort();
    return ["ALL", ...unique];
  }, []);

  const filtered = useMemo(() => {
    return allAssets.filter((a) => {
      const classOk = selectedClass === "ALL" ? true : a.assetClass === selectedClass;
      const bandOk = selectedBand === "ALL" ? true : a.riskBand === selectedBand;
      const regionOk = selectedRegion === "ALL" ? true : a.region === selectedRegion;
      const q = search.trim().toLowerCase();
      const searchOk =
        q.length === 0
          ? true
          : a.id.toLowerCase().includes(q) ||
            a.name.toLowerCase().includes(q) ||
            a.assetClass.toLowerCase().includes(q) ||
            a.region.toLowerCase().includes(q);

      return classOk && bandOk && regionOk && searchOk;
    });
  }, [selectedClass, selectedBand, selectedRegion, search]);

  const sorted = useMemo(() => sortAssets(filtered, sortKey, sortDir), [filtered, sortKey, sortDir]);

  const stats = useMemo(() => {
    const n = filtered.length || 1;
    const avgHealth = Math.round(filtered.reduce((s, a) => s + a.health, 0) / n);
    const avgCrit = Math.round(filtered.reduce((s, a) => s + a.criticality, 0) / n);
    const avgRisk = Math.round(filtered.reduce((s, a) => s + a.risk, 0) / n);

    const high = filtered.filter((a) => a.riskBand === "High").length;
    const med = filtered.filter((a) => a.riskBand === "Medium").length;
    const low = filtered.filter((a) => a.riskBand === "Low").length;

    return { avgHealth, avgCrit, avgRisk, high, med, low, count: filtered.length };
  }, [filtered]);

  function toggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(nextKey);
      setSortDir(nextKey === "id" || nextKey === "region" || nextKey === "assetClass" ? "asc" : "desc");
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--seb-navy)]">Asset Intelligence</h1>
          <p className="text-sm text-gray-600">
            Cross-asset visibility to prioritize interventions by risk, reliability impact, and readiness.
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs">
          <span className="rounded-full border bg-white px-3 py-1 text-gray-600">
            View: <span className="font-medium text-gray-800">Fleet</span>
          </span>
          <span className="rounded-full border bg-white px-3 py-1 text-gray-600">
            Data: <span className="font-medium text-gray-800">Mock</span>
          </span>
        </div>
      </div>

      {/* Asset class tiles */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {assetClasses.slice(0, 5).map((c) => (
          <button
            key={c.value}
            onClick={() => setSelectedClass(c.value)}
            className={`rounded-xl border bg-white p-4 text-left shadow-sm hover:shadow-md transition ${
              selectedClass === c.value ? "border-[var(--seb-blue)] ring-2 ring-blue-100" : "border-gray-200"
            }`}
          >
            <div className="text-xs text-gray-500 uppercase tracking-wide">Class</div>
            <div className="mt-1 font-semibold text-[var(--seb-navy)]">{c.label}</div>
            <div className="mt-2 text-xs text-gray-600">
              {c.value === "ALL"
                ? "Unified view across asset classes"
                : "Fleet health, risk drivers, and recommended actions"}
            </div>
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {kpiCard("Assets in view", `${stats.count}`, "gray")}
        {kpiCard("Avg Risk", `${stats.avgRisk} / 100`, "blue")}
        {kpiCard("High Risk", `${stats.high}`, "green")}
        {kpiCard("Avg Health", `${stats.avgHealth} / 100`, "gray")}
      </div>

      {/* Content layout */}
      <div className="grid lg:grid-cols-4 gap-5">
        {/* Filters */}
        <div className="rounded-xl bg-white border shadow-sm p-5 space-y-5">
          <div>
            <div className="font-semibold text-[var(--seb-navy)]">Filters</div>
            <div className="text-xs text-gray-500">Narrow the fleet view quickly.</div>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-gray-500">Asset class</div>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            >
              {assetClasses.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-gray-500">Risk band</div>
            <select
              value={selectedBand}
              onChange={(e) => setSelectedBand(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            >
              {riskBands.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-gray-500">Region</div>
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            >
              {regions.map((r) => (
                <option key={r} value={r}>
                  {r === "ALL" ? "All regions" : r}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-gray-500">Search</div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="TX-275-001, GIS, Kuching…"
            />
          </div>

          <div className="rounded-lg bg-gray-50 p-3 text-sm">
            <div className="text-xs text-gray-500 uppercase tracking-wide">Quick summary</div>
            <div className="mt-2 space-y-1">
              {scoreChip("Avg risk", stats.avgRisk, true)}
              {scoreChip("Avg criticality", stats.avgCrit)}
              {scoreChip("High / Med / Low", `${stats.high} / ${stats.med} / ${stats.low}` as any)}
            </div>
          </div>

          <button
            onClick={() => {
              setSelectedClass("ALL");
              setSelectedBand("ALL");
              setSelectedRegion("ALL");
              setSearch("");
              setSortKey("risk");
              setSortDir("desc");
            }}
            className="w-full rounded-lg border px-3 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Reset filters
          </button>

          <div className="text-xs text-gray-500">
            Tip: click table headers to sort; click an asset to open drill-down.
          </div>
        </div>

        {/* Table */}
        <div className="lg:col-span-3 rounded-xl bg-white border shadow-sm overflow-hidden">
          <div className="p-5 border-b flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-[var(--seb-navy)]">Fleet Table</div>
              <div className="text-xs text-gray-500">
                Prioritize by risk, then validate drivers and recommended actions.
              </div>
            </div>
            <Link
              href="/portfolio"
              className="text-sm text-[var(--seb-blue)] underline"
            >
              Back to Portfolio
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="p-3 cursor-pointer" onClick={() => toggleSort("id")}>
                    Asset ID {sortKey === "id" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                  </th>
                  <th className="p-3 cursor-pointer" onClick={() => toggleSort("assetClass")}>
                    Class {sortKey === "assetClass" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                  </th>
                  <th className="p-3 cursor-pointer" onClick={() => toggleSort("region")}>
                    Region {sortKey === "region" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                  </th>
                  <th className="p-3 cursor-pointer" onClick={() => toggleSort("health")}>
                    Health {sortKey === "health" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                  </th>
                  <th className="p-3 cursor-pointer" onClick={() => toggleSort("criticality")}>
                    Crit. {sortKey === "criticality" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                  </th>
                  <th className="p-3 cursor-pointer" onClick={() => toggleSort("risk")}>
                    Risk {sortKey === "risk" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                  </th>
                  <th className="p-3">Band</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((a) => (
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
                    <td className="p-3">{bandPill(a.riskBand)}</td>
                    <td className="p-3 text-gray-700">{a.recommendedAction}</td>
                  </tr>
                ))}

                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-gray-500">
                      No assets match your filters. Try resetting filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t text-xs text-gray-500 flex items-center justify-between">
            <div>
              Showing <span className="font-medium text-gray-700">{sorted.length}</span> asset(s)
            </div>
            <div className="hidden sm:block">
              Demo note: in production, table links to CMMS/SAP work orders and condition evidence.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}