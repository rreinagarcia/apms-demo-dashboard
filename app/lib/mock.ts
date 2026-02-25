export type RiskBand = "Low" | "Medium" | "High";

export type Indicator = {
  name: string;
  value: string;
  trend: "Improving" | "Stable" | "Deteriorating";
  severity: "Low" | "Medium" | "High";
};

export type Recommendation = {
  title: string;
  horizon: "0-3m" | "3-12m" | "12m+";
  effort: "Low" | "Medium" | "High";
  outageRequired: boolean;
  expectedRiskReduction: number; // %
  notes: string[];
};

export type Asset = {
  id: string;
  name: string;
  assetClass: string;
  voltage?: string;
  region: string;

  health: number; // 0-100 (higher = healthier)
  criticality: number; // 0-100 (higher = more critical)
  risk: number; // 0-100 (higher = higher risk)
  riskBand: RiskBand;

  lastUpdated: string;
  topDrivers: string[];

  failureProbability: { p50_12m: number; p90_12m: number; dominantMode: string };
  rul: { p50Months: number; p90Months: number; driver: string };
  indicators: Indicator[];
  recommendations: Recommendation[];
  repairVsReplace: {
    repair: { costRMm: number; leadTimeMonths: number; riskReduction: number };
    replace: { costRMm: number; leadTimeMonths: number; riskReduction: number };
    recommended: "Repair" | "Replace";
    rationale: string[];
  };

  recommendedAction: string;
  horizon: "0-3m" | "3-12m" | "12m+";
};

// --- Helpers (keep file self-contained) ---
function bandFromRisk(risk: number): RiskBand {
  if (risk >= 70) return "High";
  if (risk >= 45) return "Medium";
  return "Low";
}

function isoRecent(daysAgo: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

// A simple, consistent mapping so data feels coherent
function scoreRisk(health: number, criticality: number) {
  // Lower health + higher criticality => higher risk
  const raw = Math.round(0.62 * (100 - health) + 0.55 * criticality);
  return Math.max(15, Math.min(95, raw));
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function fpFromRisk(risk: number, mode: string) {
  // Map risk into plausible annual probabilities
  const p50 = clamp(0.03 + (risk - 20) * 0.0016, 0.03, 0.22);
  const p90 = clamp(p50 * 2.2, 0.06, 0.45);
  return { p50_12m: Number(p50.toFixed(2)), p90_12m: Number(p90.toFixed(2)), dominantMode: mode };
}

function rulFromRisk(risk: number, driver: string) {
  // Higher risk => lower RUL
  const p50 = clamp(Math.round(60 - risk * 0.5), 6, 72);
  const p90 = clamp(Math.round(p50 * 0.55), 3, 48);
  return { p50Months: p50, p90Months: p90, driver };
}

function decisionFromRisk(risk: number) {
  // Higher risk shifts toward replace
  const recommend = risk >= 78 ? "Replace" : "Repair";
  const repair = {
    costRMm: Number(clamp(0.5 + risk * 0.02, 0.6, 3.0).toFixed(1)),
    leadTimeMonths: clamp(Math.round(2 + risk * 0.06), 2, 8),
    riskReduction: clamp(Math.round(12 + risk * 0.18), 15, 35),
  };
  const replace = {
    costRMm: Number(clamp(4.0 + risk * 0.07, 4.5, 12.0).toFixed(1)),
    leadTimeMonths: clamp(Math.round(7 + risk * 0.12), 8, 18),
    riskReduction: clamp(Math.round(35 + risk * 0.22), 45, 70),
  };

  const rationale =
    recommend === "Replace"
      ? [
          "High consequence and accelerating degradation signals",
          "Replacement provides step-change risk reduction vs incremental repairs",
          "Align with medium-term capex window and procurement lead time",
        ]
      : [
          "Repair achieves meaningful risk reduction with shorter lead time",
          "Monitor post-intervention to validate risk reduction",
          "Keep replacement as contingency if trend deteriorates",
        ];

  return { repair, replace, recommended: recommend as "Repair" | "Replace", rationale };
}

function recsForClass(assetClass: string, risk: number, drivers: string[]): Recommendation[] {
  const horizon1: Recommendation["horizon"] = risk >= 75 ? "0-3m" : "3-12m";
  const effort1: Recommendation["effort"] = risk >= 75 ? "High" : "Medium";

  const base: Recommendation = {
    title: "Condition assessment + prioritized work pack",
    horizon: horizon1,
    effort: effort1,
    outageRequired: assetClass.includes("Transformer") ? false : risk >= 80,
    expectedRiskReduction: clamp(Math.round(10 + risk * 0.22), 10, 35),
    notes: [
      `Validate drivers: ${drivers.slice(0, 2).join("; ")}`,
      "Bundle tasks into single outage / window where feasible",
      "Update risk score after evidence is ingested (post-work)",
    ],
  };

  const add: Recommendation =
    risk >= 78
      ? {
          title: "Planned outage intervention",
          horizon: "0-3m",
          effort: "High",
          outageRequired: true,
          expectedRiskReduction: clamp(Math.round(18 + risk * 0.25), 25, 45),
          notes: [
            "Execute corrective actions with safety + reliability constraints",
            "Confirm parts availability and switching plan before outage",
          ],
        }
      : {
          title: "Optimize inspection interval + backlog burn-down",
          horizon: "3-12m",
          effort: "Medium",
          outageRequired: false,
          expectedRiskReduction: clamp(Math.round(8 + risk * 0.12), 10, 25),
          notes: [
            "Tune inspection frequency using leading indicators",
            "Burn down highest-risk corrective items first",
          ],
        };

  return risk >= 55 ? [base, add] : [base];
}

function indicatorsForClass(assetClass: string, voltage: string | undefined, risk: number): Indicator[] {
  const sev = (x: number): Indicator["severity"] => (x >= 78 ? "High" : x >= 55 ? "Medium" : "Low");
  const trend = (x: number): Indicator["trend"] => (x >= 78 ? "Deteriorating" : x >= 55 ? "Stable" : "Improving");

  if (assetClass.includes("Power Transformer") || assetClass.includes("Distribution Transformer")) {
    return [
      { name: "DGA (key gases)", value: risk >= 75 ? "Rising (C2H2/C2H4)" : "Within expected range", trend: trend(risk), severity: sev(risk) },
      { name: "Oil moisture", value: risk >= 70 ? "30–45 ppm" : "10–25 ppm", trend: risk >= 70 ? "Stable" : "Improving", severity: sev(risk - 10) },
      { name: "Bushing condition", value: risk >= 80 ? "Flagged" : "Normal", trend: trend(risk - 5), severity: sev(risk - 5) },
      { name: "Load factor", value: voltage ? `${voltage} • ${risk >= 70 ? "0.75–0.88" : "0.55–0.75"}` : "0.65", trend: "Stable", severity: risk >= 75 ? "Medium" : "Low" },
    ];
  }

  if (assetClass.includes("Switchgear")) {
    return [
      { name: "PD trend", value: risk >= 70 ? "Moderate, rising" : "Low / stable", trend: trend(risk), severity: sev(risk) },
      { name: "Gas pressure", value: "Within range", trend: "Stable", severity: "Low" },
      { name: "Operations count", value: risk >= 70 ? "High cycling" : "Normal", trend: "Stable", severity: risk >= 70 ? "Medium" : "Low" },
    ];
  }

  if (assetClass.includes("Circuit Breaker")) {
    return [
      { name: "Timing deviation", value: risk >= 70 ? "Out of tolerance" : "Within tolerance", trend: trend(risk), severity: sev(risk) },
      { name: "Mechanism wear", value: risk >= 75 ? "Elevated" : "Normal", trend: trend(risk - 5), severity: sev(risk - 5) },
      { name: "SF6 density / pressure", value: "Normal", trend: "Stable", severity: "Low" },
    ];
  }

  if (assetClass.includes("Overhead Line")) {
    return [
      { name: "Vegetation exposure", value: risk >= 70 ? "High" : "Moderate", trend: trend(risk), severity: sev(risk) },
      { name: "Lightning density", value: risk >= 70 ? "Elevated" : "Normal", trend: "Stable", severity: risk >= 70 ? "Medium" : "Low" },
      { name: "Hotspot scan", value: risk >= 75 ? "1–2 hotspots" : "No hotspots", trend: trend(risk - 5), severity: sev(risk - 5) },
    ];
  }

  if (assetClass.includes("Underground Cable")) {
    return [
      { name: "Sheath test", value: risk >= 70 ? "Marginal" : "Pass", trend: trend(risk), severity: sev(risk) },
      { name: "Partial discharge", value: risk >= 75 ? "Intermittent flags" : "None", trend: trend(risk - 5), severity: sev(risk - 5) },
      { name: "Joint condition", value: risk >= 70 ? "Aged joint set" : "Normal", trend: "Stable", severity: risk >= 70 ? "Medium" : "Low" },
    ];
  }

  if (assetClass.includes("Substation")) {
    return [
      { name: "Aux supply health", value: risk >= 70 ? "Repeated alarms" : "Stable", trend: trend(risk), severity: sev(risk) },
      { name: "SCADA comms", value: risk >= 75 ? "Intermittent drops" : "Stable", trend: trend(risk - 5), severity: sev(risk - 5) },
      { name: "Backlog", value: risk >= 70 ? "Elevated" : "Normal", trend: "Stable", severity: risk >= 70 ? "Medium" : "Low" },
    ];
  }

  // Protection & Control
  return [
    { name: "Relay self-test", value: risk >= 70 ? "Intermittent fails" : "Pass", trend: trend(risk), severity: sev(risk) },
    { name: "Settings validity", value: risk >= 75 ? "Review required" : "OK", trend: "Stable", severity: risk >= 75 ? "Medium" : "Low" },
    { name: "Comm link", value: risk >= 70 ? "High latency" : "Normal", trend: trend(risk - 5), severity: sev(risk - 5) },
  ];
}

// --- 36 Assets dataset ---
export const assets: Asset[] = [
  // Power Transformers (8)
  mkTx("TX-275-001", "TX 275/132kV – Main Bank A", "Power Transformer", "275kV", "Kuching", 62, 90, ["DGA anomaly trend", "High load criticality", "Age profile"], "Insulation degradation", "Oil quality + DGA trend"),
  mkTx("TX-275-002", "TX 275/132kV – Main Bank B", "Power Transformer", "275kV", "Kuching", 68, 88, ["Bushing PD flags", "Cooling performance drift"], "Bushing failure", "PD + thermal trend"),
  mkTx("TX-275-011", "TX 275/132kV – North Tie", "Power Transformer", "275kV", "Sibu", 73, 84, ["Thermal hotspots", "Backlog corrective work"], "Thermal ageing", "Hotspot scan + load profile"),
  mkTx("TX-132-017", "TX 132/33kV – City Sub", "Power Transformer", "132kV", "Bintulu", 70, 82, ["Moisture elevated", "High consequence node"], "Paper insulation ageing", "Moisture + loading"),
  mkTx("TX-132-021", "TX 132/33kV – Industrial", "Power Transformer", "132kV", "Miri", 58, 86, ["DGA rising", "Tap-changer wear"], "OLTC wear", "OLTC ops + DGA"),
  mkTx("TX-132-033", "TX 132/33kV – Coastal", "Power Transformer", "132kV", "Mukah", 76, 74, ["Salt corrosion exposure", "Minor alarms"], "External corrosion", "Environment exposure"),
  mkTx("TX-132-041", "TX 132/33kV – East Feeder", "Power Transformer", "132kV", "Kuching", 81, 78, ["Stable indicators", "Moderate criticality"], "General ageing", "Age profile"),
  mkTx("TX-275-020", "TX 275/132kV – Bulk Supply", "Power Transformer", "275kV", "Miri", 55, 92, ["Rapid DGA increase", "High customer impact"], "Insulation degradation", "DGA + PD"),

  // Distribution Transformers (6)
  mkTx("DT-33-104", "DT 33/11kV – Town Center", "Distribution Transformer", "33kV", "Kuching", 74, 65, ["Backlog minor defects", "Moderate loading"], "General ageing", "Backlog + loading"),
  mkTx("DT-33-118", "DT 33/11kV – Airport Feeder", "Distribution Transformer", "33kV", "Miri", 66, 72, ["Oil moisture rising", "High cycling"], "Moisture ingress", "Moisture + cycling"),
  mkTx("DT-11-260", "DT 11/0.4kV – Commercial", "Distribution Transformer", "11kV", "Bintulu", 79, 60, ["Stable indicators"], "General ageing", "Age profile"),
  mkTx("DT-11-271", "DT 11/0.4kV – Hospital", "Distribution Transformer", "11kV", "Kuching", 63, 80, ["Thermal alarms", "High criticality load"], "Thermal ageing", "Thermal + loading"),
  mkTx("DT-33-140", "DT 33/11kV – Rural Hub", "Distribution Transformer", "33kV", "Sibu", 82, 58, ["Low defect rate"], "General ageing", "Age profile"),
  mkTx("DT-11-299", "DT 11/0.4kV – Industrial Park", "Distribution Transformer", "11kV", "Samalaju", 61, 77, ["Oil quality degradation", "High utilisation"], "Oil degradation", "Oil tests + utilisation"),

  // Switchgear GIS/AIS (8)
  mkAsset("SW-GIS-132-014", "GIS Bay 14 – 132kV", "Switchgear (GIS/AIS)", "132kV", "Bintulu", 71, 78, ["Partial discharge flags", "Maintenance backlog"], "PD / insulation stress", "PD trend + backlog"),
  mkAsset("SW-GIS-132-019", "GIS Bay 19 – 132kV", "Switchgear (GIS/AIS)", "132kV", "Kuching", 64, 83, ["PD moderate rising", "High operations count"], "PD / insulation stress", "PD + operations"),
  mkAsset("SW-AIS-33-031", "AIS Panel 31 – 33kV", "Switchgear (GIS/AIS)", "33kV", "Sibu", 77, 62, ["Backlog minor defects"], "Contact wear", "Backlog"),
  mkAsset("SW-AIS-33-045", "AIS Panel 45 – 33kV", "Switchgear (GIS/AIS)", "33kV", "Miri", 69, 70, ["Environmental exposure", "Ops count elevated"], "Contact wear", "Ops + environment"),
  mkAsset("SW-GIS-275-004", "GIS Bay 04 – 275kV", "Switchgear (GIS/AIS)", "275kV", "Kuching", 60, 90, ["PD rising", "High consequence bay"], "PD / insulation stress", "PD trend"),
  mkAsset("SW-GIS-275-008", "GIS Bay 08 – 275kV", "Switchgear (GIS/AIS)", "275kV", "Miri", 72, 86, ["High cycling", "Backlog corrective"], "Mechanism wear", "Operations + backlog"),
  mkAsset("SW-AIS-132-022", "AIS Panel 22 – 132kV", "Switchgear (GIS/AIS)", "132kV", "Mukah", 81, 64, ["Stable indicators"], "General ageing", "Age profile"),
  mkAsset("SW-AIS-33-052", "AIS Panel 52 – 33kV", "Switchgear (GIS/AIS)", "33kV", "Bintulu", 58, 74, ["PD intermittent", "Backlog"], "PD / insulation stress", "PD + backlog"),

  // Circuit Breakers (6)
  mkAsset("CB-132-088", "Circuit Breaker 88 – 132kV", "Circuit Breaker", "132kV", "Miri", 66, 70, ["Timing drift", "Operating mechanism wear"], "Mechanism wear", "Timing drift"),
  mkAsset("CB-132-041", "Circuit Breaker 41 – 132kV", "Circuit Breaker", "132kV", "Kuching", 73, 68, ["Ops count elevated", "Minor timing drift"], "Contact wear", "Operations count"),
  mkAsset("CB-275-006", "Circuit Breaker 06 – 275kV", "Circuit Breaker", "275kV", "Kuching", 57, 92, ["Timing out-of-tolerance", "High criticality"], "Mechanism wear", "Timing + criticality"),
  mkAsset("CB-33-120", "Circuit Breaker 120 – 33kV", "Circuit Breaker", "33kV", "Sibu", 79, 55, ["Stable condition"], "General ageing", "Age profile"),
  mkAsset("CB-33-133", "Circuit Breaker 133 – 33kV", "Circuit Breaker", "33kV", "Bintulu", 62, 67, ["Mechanism wear flags"], "Mechanism wear", "Wear trend"),
  mkAsset("CB-132-099", "Circuit Breaker 99 – 132kV", "Circuit Breaker", "132kV", "Mukah", 70, 73, ["Backlog corrective items"], "Contact wear", "Backlog"),

  // Overhead Lines (5)
  mkAsset("OHL-275-SEG-03", "OHL Segment 03 – 275kV", "Overhead Line", "275kV", "Sibu", 79, 74, ["Vegetation exposure", "Lightning density"], "Weather exposure", "Vegetation + lightning"),
  mkAsset("OHL-132-SEG-12", "OHL Segment 12 – 132kV", "Overhead Line", "132kV", "Miri", 68, 80, ["Vegetation hotspots", "High consequence corridor"], "Vegetation/flashover", "Vegetation exposure"),
  mkAsset("OHL-132-SEG-07", "OHL Segment 07 – 132kV", "Overhead Line", "132kV", "Kuching", 82, 72, ["Low defect rate"], "General ageing", "Age profile"),
  mkAsset("OHL-33-SEG-21", "OHL Segment 21 – 33kV", "Overhead Line", "33kV", "Mukah", 61, 60, ["Lightning exposure", "Connector wear"], "Connector wear", "Hotspot scan"),
  mkAsset("OHL-275-SEG-09", "OHL Segment 09 – 275kV", "Overhead Line", "275kV", "Bintulu", 58, 88, ["Repeated hotspot flags", "High consequence link"], "Conductor hotspot", "Hotspot scan + loading"),

  // Underground Cables (2)
  mkAsset("UGC-132-004", "UGC Circuit 04 – 132kV", "Underground Cable", "132kV", "Kuching", 63, 81, ["PD intermittent flags", "Aged joints"], "Joint degradation", "PD + joints"),
  mkAsset("UGC-33-018", "UGC Circuit 18 – 33kV", "Underground Cable", "33kV", "Miri", 76, 66, ["Stable test history"], "General ageing", "Age profile"),

  // Substations (1)
  mkAsset("SUB-132-009", "Substation – 132kV Node 09", "Substation", "132kV", "Bintulu", 67, 85, ["Aux supply alarms", "SCADA drops"], "Aux/SCADA reliability", "Alarms + comms"),

  // Protection & Control (1)
  mkAsset("PC-132-REL-022", "Relay Set 022 – 132kV", "Protection & Control", "132kV", "Kuching", 72, 76, ["Self-test intermittent fails", "Settings review due"], "Relay misoperation", "Self-test + settings"),
];

// --- Builders for consistency ---
function mkAsset(
  id: string,
  name: string,
  assetClass: string,
  voltage: string,
  region: string,
  health: number,
  criticality: number,
  topDrivers: string[],
  dominantMode: string,
  rulDriver: string
): Asset {
  const risk = scoreRisk(health, criticality);
  const riskBand = bandFromRisk(risk);
  const fp = fpFromRisk(risk, dominantMode);
  const rul = rulFromRisk(risk, rulDriver);
  const indicators = indicatorsForClass(assetClass, voltage, risk);
  const recommendations = recsForClass(assetClass, risk, topDrivers);
  const repairVsReplace = decisionFromRisk(risk);

  const horizon: Asset["horizon"] = risk >= 78 ? "0-3m" : risk >= 55 ? "3-12m" : "12m+";
  const recommendedAction = recommendations[0]?.title ?? "Review and create work pack";

  return {
    id,
    name,
    assetClass,
    voltage,
    region,
    health,
    criticality,
    risk,
    riskBand,
    lastUpdated: isoRecent((risk % 6) + 1),
    topDrivers,
    failureProbability: fp,
    rul,
    indicators,
    recommendations,
    repairVsReplace,
    recommendedAction,
    horizon,
  };
}

function mkTx(
  id: string,
  name: string,
  assetClass: string,
  voltage: string,
  region: string,
  health: number,
  criticality: number,
  topDrivers: string[],
  dominantMode: string,
  rulDriver: string
) {
  // For transformers, tweak risk slightly upward if health is very low (to create richer distribution)
  const base = mkAsset(id, name, assetClass, voltage, region, health, criticality, topDrivers, dominantMode, rulDriver);
  const extra = health <= 58 ? 6 : health <= 62 ? 3 : 0;

  const risk = clamp(base.risk + extra, 15, 95);
  const riskBand = bandFromRisk(risk);

  return {
    ...base,
    risk,
    riskBand,
    failureProbability: fpFromRisk(risk, dominantMode),
    rul: rulFromRisk(risk, rulDriver),
    recommendations: recsForClass(assetClass, risk, topDrivers),
    repairVsReplace: decisionFromRisk(risk),
    horizon: risk >= 78 ? "0-3m" : risk >= 55 ? "3-12m" : "12m+",
  };
}

console.log("MOCK ASSETS COUNT:", assets.length);
