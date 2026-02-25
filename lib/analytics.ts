// lib/analytics.ts
export type Horizon = "3m" | "6m" | "12m" | "24m";

export type AssetLike = {
  id: string;
  name: string;
  assetClass: string;
  region: string;
  health: number; // 0–100 (higher = better)
  criticality: number; // 0–100
  risk: number; // 0–100
};

export function failureCostRMm(assetClass: string) {
  if (assetClass.includes("Power Transformer")) return 25;
  if (assetClass.includes("Distribution Transformer")) return 5;
  if (assetClass.includes("Switchgear")) return 8;
  if (assetClass.includes("Circuit Breaker")) return 3;
  if (assetClass.includes("Overhead Line")) return 4;
  if (assetClass.includes("Underground Cable")) return 6;
  if (assetClass.includes("Substation")) return 10;
  if (assetClass.includes("Protection")) return 2;
  if (assetClass.includes("Vegetation")) return 1;
  return 2;
}

function classFactor(assetClass: string) {
  if (assetClass.includes("Power Transformer")) return 8;
  if (assetClass.includes("Switchgear")) return 6;
  if (assetClass.includes("Underground Cable")) return 6;
  if (assetClass.includes("Circuit Breaker")) return 4;
  if (assetClass.includes("Overhead Line")) return 5;
  if (assetClass.includes("Protection")) return 3;
  if (assetClass.includes("Vegetation")) return 4;
  return 5;
}

export function pofIndex(asset: AssetLike): Record<Horizon, number> {
  const deg = 100 - asset.health;
  const cf = classFactor(asset.assetClass);

  const p3 = Math.round(0.75 * asset.risk + 0.20 * deg + 0.05 * asset.criticality + 0.35 * cf);
  const p6 = Math.round(0.62 * asset.risk + 0.30 * deg + 0.08 * asset.criticality + 0.45 * cf);
  const p12 = Math.round(0.48 * asset.risk + 0.40 * deg + 0.12 * asset.criticality + 0.55 * cf);
  const p24 = Math.round(0.32 * asset.risk + 0.52 * deg + 0.16 * asset.criticality + 0.65 * cf);

  const clamp = (x: number) => Math.max(0, Math.min(100, x));

  return {
    "3m": clamp(p3),
    "6m": clamp(p6),
    "12m": clamp(p12),
    "24m": clamp(p24),
  };
}

export function expectedExposureRMm(asset: AssetLike, horizon: Horizon) {
  const pof = pofIndex(asset)[horizon];
  const cost = failureCostRMm(asset.assetClass);
  return Number(((pof / 100) * cost).toFixed(1));
}

export type InterventionType = "OPEX" | "CAPEX";

export type InterventionOption = {
  assetId: string;
  assetName: string;
  assetClass: string;
  region: string;

  type: InterventionType;
  action: string;
  leadTimeMonths: number;

  costRMm: number;
  pofMultiplier: number;
  confidence: "High" | "Medium" | "Low";
};

function confidence(assetClass: string): "High" | "Medium" | "Low" {
  if (assetClass.includes("Power Transformer")) return "High";
  if (assetClass.includes("Switchgear") || assetClass.includes("Substation")) return "Medium";
  if (assetClass.includes("Vegetation") || assetClass.includes("Overhead Line")) return "Low";
  return "Medium";
}

export function interventionOptions(asset: AssetLike): InterventionOption[] {
  const baseExposure12 = expectedExposureRMm(asset, "12m");
  const classCost = failureCostRMm(asset.assetClass);
  const c = confidence(asset.assetClass);

  const opexCost = Number(Math.max(0.3, Math.min(6, 0.15 * classCost + 0.05 * baseExposure12)).toFixed(1));
  const opexMultiplier = asset.risk >= 70 ? 0.65 : asset.risk >= 45 ? 0.72 : 0.80;

  const capexCost = Number(Math.max(2, Math.min(45, 0.65 * classCost + 0.25 * baseExposure12)).toFixed(1));
  const capexMultiplier = asset.risk >= 70 ? 0.25 : asset.risk >= 45 ? 0.35 : 0.45;

  const opexAction =
    asset.assetClass.includes("Transformer")
      ? "Condition work pack (DGA + oil, bushings, targeted maintenance)"
      : asset.assetClass.includes("Switchgear")
      ? "Condition work pack (PD scan + seals, targeted maintenance)"
      : asset.assetClass.includes("Cable")
      ? "Condition work pack (PD testing, joint inspection, thermal survey)"
      : asset.assetClass.includes("Overhead Line")
      ? "Hotspot + vegetation / inspection program pack"
      : "Condition inspection & corrective pack";

  const capexAction =
    asset.assetClass.includes("Transformer")
      ? "Replace / refurbish major component (risk retirement)"
      : asset.assetClass.includes("Switchgear")
      ? "Refurbish / replace panel / bay (risk retirement)"
      : asset.assetClass.includes("Cable")
      ? "Replace circuit section / rehab joints (risk retirement)"
      : asset.assetClass.includes("Overhead Line")
      ? "Reconductoring / reinforcement (risk retirement)"
      : "Replace / upgrade (risk retirement)";

  return [
    {
      assetId: asset.id,
      assetName: asset.name,
      assetClass: asset.assetClass,
      region: asset.region,
      type: "OPEX",
      action: opexAction,
      leadTimeMonths: asset.assetClass.includes("Transformer") ? 2 : 1,
      costRMm: opexCost,
      pofMultiplier: opexMultiplier,
      confidence: c,
    },
    {
      assetId: asset.id,
      assetName: asset.name,
      assetClass: asset.assetClass,
      region: asset.region,
      type: "CAPEX",
      action: capexAction,
      leadTimeMonths: asset.assetClass.includes("Transformer") ? 10 : 6,
      costRMm: capexCost,
      pofMultiplier: capexMultiplier,
      confidence: c,
    },
  ];
}
