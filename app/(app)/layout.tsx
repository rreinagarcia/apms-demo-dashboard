"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function StatusDot({ status }: { status: "green" | "yellow" | "red" }) {
  const color =
    status === "green"
      ? "bg-emerald-500"
      : status === "yellow"
      ? "bg-amber-400"
      : "bg-red-500";

  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${color}`} />;
}

function NavItem({
  href,
  label,
  status,
}: {
  href: string;
  label: string;
  status: "green" | "yellow" | "red";
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
        active ? "bg-[var(--seb-blue)] text-white" : "text-gray-700 hover:bg-gray-100"
      }`}
    >
      <StatusDot status={status} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Sticky Sidebar */}
        <aside className="sticky top-0 h-screen w-72 bg-white border-r shadow-sm flex flex-col">
          <div className="px-6 py-5 border-b">
            <div className="text-xs text-gray-500 uppercase tracking-wide">Sarawak Energy</div>
            <div className="text-lg font-semibold text-[var(--seb-navy)]">APMS Platform</div>
            <div className="text-xs text-gray-500 mt-1">Risk & Asset Intelligence (Demo)</div>
          </div>

          <nav className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Welcome / Navigation */}
            <div>
              <div className="text-[11px] text-gray-400 uppercase mb-2">Welcome</div>
              <div className="space-y-1">
                <NavItem href="/overview" label="Platform Overview" status="green" />
              </div>
            </div>

            {/* Executive */}
            <div>
              <div className="text-[11px] text-gray-400 uppercase mb-2">Executive</div>
              <div className="space-y-1">
                <NavItem href="/dashboard" label="Executive Dashboard" status="green" />
                <NavItem href="/analytics" label="Portfolio Analytics" status="green" />
                <NavItem href="/capital" label="Capital Optimization – Annual Plan" status="green" />
                <NavItem href="/planning" label="5-Year Strategic Asset Plan" status="yellow" />
              </div>
            </div>

            {/* Foundations */}
            <div>
              <div className="text-[11px] text-gray-400 uppercase mb-2">Foundations</div>
              <div className="space-y-1">
                <NavItem href="/data-health" label="Data & Model Health" status="yellow" />
              </div>
            </div>

            {/* Operations */}
            <div>
              <div className="text-[11px] text-gray-400 uppercase mb-2">Operations</div>
              <div className="space-y-1">
                <NavItem href="/assets" label="Asset Intelligence" status="green" />
                <NavItem href="/programs" label="Intervention Program Builder" status="yellow" />
              </div>
            </div>

            {/* Predictive */}
            <div>
              <div className="text-[11px] text-gray-400 uppercase mb-2">Predictive Modules</div>
              <div className="space-y-1">
                <NavItem href="/predictive" label="Predictive Analytics Hub" status="red" />
                <NavItem href="/predictive/pof" label="PoF Forecast" status="red" />
                <NavItem href="/predictive/rul" label="RUL & EoL Planning" status="red" />
                <NavItem href="/predictive/anomalies" label="Anomaly Detection" status="red" />
                <NavItem href="/predictive/prescriptive" label="Prescriptive Actions" status="red" />
              </div>
            </div>

            {/* Outputs */}
            <div>
              <div className="text-[11px] text-gray-400 uppercase mb-2">Outputs</div>
              <div className="space-y-1">
                <NavItem href="/reports" label="Reports & Downloads" status="green" />
              </div>
            </div>
          </nav>

          {/* Sidebar Legend */}
          <div className="border-t p-4 text-xs text-gray-600 space-y-2">
            <div className="font-semibold text-[var(--seb-navy)]">Delivery Readiness</div>
            <div className="flex items-center gap-2">
              <StatusDot status="green" /> <span>Ready for Phase 1 Pilot</span>
            </div>
            <div className="flex items-center gap-2">
              <StatusDot status="yellow" /> <span>Partially Ready (Phase 1 Foundation)</span>
            </div>
            <div className="flex items-center gap-2">
              <StatusDot status="red" /> <span>Phase 2+ Capability</span>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}