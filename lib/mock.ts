export type RepairReplaceOption = {
  costRMm: number;
  riskReduction: number; // points (0–100 index aggregated concept)
};

export type Asset = {
  id: string;
  name: string;
  assetClass:
    | "Power Transformer"
    | "Distribution Transformer"
    | "Switchgear (GIS/AIS)"
    | "Circuit Breaker"
    | "Overhead Line"
    | "Underground Cable"
    | "Substation"
    | "Protection & Control"
    | "Vegetation Zone";
  region: "Kuching" | "Sibu" | "Miri" | "Bintulu" | "Sri Aman";

  voltagekV: number;

  // 0–100 indices (demo)
  health: number;
  criticality: number;
  risk: number; // 0–100 index (demo)
  riskBand: "High" | "Medium" | "Low";

  horizon: "3m" | "6m" | "12m" | "24m";
  recommendedAction: string;

  // Used by Capital Optimization – Annual Plan
  repairVsReplace?: {
    repair?: RepairReplaceOption;  // OPEX
    replace?: RepairReplaceOption; // CAPEX
  };

  // Optional: used by drill-down pages if you show them later
  recommendations?: { title: string; rationale: string; owner: string; due: string }[];
};

function bandFromRisk(risk: number): Asset["riskBand"] {
  if (risk >= 70) return "High";
  if (risk >= 45) return "Medium";
  return "Low";
}

function horizonFromRisk(risk: number): Asset["horizon"] {
  if (risk >= 80) return "3m";
  if (risk >= 65) return "6m";
  if (risk >= 45) return "12m";
  return "24m";
}

function recFromClass(assetClass: Asset["assetClass"], riskBand: Asset["riskBand"]): string {
  const urgent = riskBand === "High";
  if (assetClass.includes("Transformer")) return urgent ? "Plan outage + targeted diagnostics" : "Monitor + condition tests";
  if (assetClass.includes("Switchgear")) return urgent ? "PD campaign + bay inspection" : "Monitor PD trend";
  if (assetClass.includes("Circuit Breaker")) return urgent ? "Mechanism check + timing test" : "Routine test & monitor";
  if (assetClass.includes("Overhead Line")) return urgent ? "Patrol + hotspot remediation" : "Targeted patrol";
  if (assetClass.includes("Underground Cable")) return urgent ? "Joint inspection + thermal survey" : "Monitor load & temp";
  if (assetClass.includes("Substation")) return urgent ? "Aux systems inspection + defects clear" : "Planned inspection";
  if (assetClass.includes("Protection")) return urgent ? "Settings audit + relay test" : "Governance review";
  if (assetClass.includes("Vegetation")) return urgent ? "Priority trimming (risk corridors)" : "Seasonal trimming";
  return urgent ? "Targeted inspection" : "Monitor";
}

function rrOptions(assetClass: Asset["assetClass"], risk: number) {
  // Simple, believable envelope: CAPEX bigger impact & cost; OPEX smaller & cheaper
  const baseCapex = assetClass.includes("Power Transformer") ? 18 :
                    assetClass.includes("Distribution Transformer") ? 6 :
                    assetClass.includes("Switchgear") ? 10 :
                    assetClass.includes("Circuit Breaker") ? 4 :
                    assetClass.includes("Underground Cable") ? 12 :
                    assetClass.includes("Overhead Line") ? 8 :
                    assetClass.includes("Substation") ? 14 :
                    assetClass.includes("Protection") ? 2 :
                    3;

  const baseOpex = assetClass.includes("Power Transformer") ? 1.4 :
                   assetClass.includes("Distribution Transformer") ? 0.6 :
                   assetClass.includes("Switchgear") ? 0.9 :
                   assetClass.includes("Circuit Breaker") ? 0.4 :
                   assetClass.includes("Underground Cable") ? 1.0 :
                   assetClass.includes("Overhead Line") ? 0.7 :
                   assetClass.includes("Substation") ? 1.2 :
                   assetClass.includes("Protection") ? 0.3 :
                   0.5;

  const capexImpact = Math.max(10, Math.min(35, Math.round(risk * 0.35)));
  const opexImpact  = Math.max(6,  Math.min(18, Math.round(risk * 0.18)));

  return {
    repair: { costRMm: Number(baseOpex.toFixed(1)), riskReduction: opexImpact },
    replace: { costRMm: Number(baseCapex.toFixed(1)), riskReduction: capexImpact },
  };
}

const REGIONS: Asset["region"][] = ["Kuching", "Sibu", "Miri", "Bintulu", "Sri Aman"];

const catalog: Array<Pick<Asset, "assetClass" | "voltagekV">> = [
  { assetClass: "Power Transformer", voltagekV: 275 },
  { assetClass: "Power Transformer", voltagekV: 132 },
  { assetClass: "Distribution Transformer", voltagekV: 33 },
  { assetClass: "Distribution Transformer", voltagekV: 11 },
  { assetClass: "Switchgear (GIS/AIS)", voltagekV: 275 },
  { assetClass: "Switchgear (GIS/AIS)", voltagekV: 132 },
  { assetClass: "Circuit Breaker", voltagekV: 132 },
  { assetClass: "Circuit Breaker", voltagekV: 33 },
  { assetClass: "Overhead Line", voltagekV: 132 },
  { assetClass: "Overhead Line", voltagekV: 33 },
  { assetClass: "Underground Cable", voltagekV: 132 },
  { assetClass: "Underground Cable", voltagekV: 33 },
  { assetClass: "Substation", voltagekV: 132 },
  { assetClass: "Substation", voltagekV: 33 },
  { assetClass: "Protection & Control", voltagekV: 132 },
  { assetClass: "Protection & Control", voltagekV: 33 },
  { assetClass: "Vegetation Zone", voltagekV: 33 },
  { assetClass: "Vegetation Zone", voltagekV: 11 },
];

// Deterministic spreads across health/risk (no randomness)
const healthSeries = [88, 74, 63, 52, 41, 35, 79, 68, 57, 49, 44, 31, 83, 71, 60, 55, 46, 38];
const riskSeries   = [22, 35, 46, 58, 71, 84, 28, 41, 53, 64, 76, 90, 25, 39, 50, 61, 73, 86];
const critSeries   = [35, 44, 52, 61, 70, 82, 40, 49, 57, 66, 74, 88, 38, 46, 55, 63, 72, 85];

export const assets: Asset[] = Array.from({ length: 36 }).map((_, i) => {
  const template = catalog[i % catalog.length];
  const region = REGIONS[i % REGIONS.length];

  const health = healthSeries[i % healthSeries.length];
  const risk = riskSeries[i % riskSeries.length];
  const criticality = critSeries[i % critSeries.length];

  const riskBand = bandFromRisk(risk);
  const horizon = horizonFromRisk(risk);

  const idPrefix =
    template.assetClass === "Power Transformer" ? "TX" :
    template.assetClass === "Distribution Transformer" ? "DT" :
    template.assetClass === "Switchgear (GIS/AIS)" ? "GIS" :
    template.assetClass === "Circuit Breaker" ? "CB" :
    template.assetClass === "Overhead Line" ? "OHL" :
    template.assetClass === "Underground Cable" ? "UGC" :
    template.assetClass === "Substation" ? "SS" :
    template.assetClass === "Protection & Control" ? "P&C" :
    "VEG";

  const id = `${idPrefix}-${String(template.voltagekV).padStart(3, "0")}-${String(i + 1).padStart(3, "0")}`;

  const name = `${template.assetClass} – ${region} ${template.voltagekV}kV`;

  return {
    id,
    name,
    assetClass: template.assetClass,
    region,
    voltagekV: template.voltagekV,
    health,
    criticality,
    risk,
    riskBand,
    horizon,
    recommendedAction: recFromClass(template.assetClass, riskBand),
    repairVsReplace: rrOptions(template.assetClass, risk),
    recommendations: [
      {
        title: "Validate condition evidence",
        rationale: "Confirm anomalies and recent inspection/test results before committing resources.",
        owner: "Asset Engineer",
        due: "14 days",
      },
      {
        title: "Prepare program pack",
        rationale: "Bundle similar interventions by region/class for efficient outage planning.",
        owner: "Planner",
        due: "30 days",
      },
    ],
  };
});