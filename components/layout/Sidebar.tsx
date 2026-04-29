"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, Droplets, Bell, Settings, FileText,
  Zap, FlaskConical, Menu, X, HardDrive, PlayCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "总览",      href: "/dashboard", icon: LayoutDashboard },
  { label: "实时监控",  href: "/stations",  icon: Droplets },
  { label: "告警中心",  href: "/alerts",    icon: Bell },
  { label: "控制下发",  href: "/control",   icon: Zap },
  { label: "化验记录",  href: "/lab",       icon: FlaskConical },
  { label: "运营报表",  href: "/reports",   icon: FileText },
  { label: "硬件指南",  href: "/docs",      icon: HardDrive },
  { label: "演示控制台",href: "/demo",      icon: PlayCircle, highlight: true },
  { label: "系统设置",  href: "/settings",  icon: Settings, comingSoon: true },
];

function NavLinks({ pathname, onClose }: { pathname: string; onClose?: () => void }) {
  return (
    <nav className="flex-1 space-y-0.5 px-3 py-4">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
        const hi = (item as { highlight?: boolean }).highlight;
        return (
          <Link
            key={item.href}
            href={item.comingSoon ? "#" : item.href}
            onClick={onClose}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
              isActive
                ? "bg-[#E8472A] text-white shadow-sm"
                : hi
                ? "text-[#E8472A] hover:bg-orange-50"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-800",
              item.comingSoon && "cursor-not-allowed opacity-40"
            )}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            <span>{item.label}</span>
            {item.comingSoon && (
              <span className="ml-auto rounded-md text-[9px] bg-slate-100 px-1.5 py-0.5 text-slate-400 font-normal">
                即将上线
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5 px-4 py-5 border-b border-slate-100">
      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#E8472A] shadow-sm">
        <Droplets className="h-4 w-4 text-white" />
      </div>
      <div>
        <p className="text-sm font-bold text-slate-800 leading-none">污水托管</p>
        <p className="text-[10px] text-slate-400 mt-0.5">WaterOps SaaS</p>
      </div>
    </div>
  );
}

function StatusDot() {
  return (
    <div className="border-t border-slate-100 px-4 py-4 mx-3 mb-2">
      <div className="flex items-center gap-2 rounded-xl bg-green-50 px-3 py-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
        </span>
        <span className="text-xs font-medium text-green-700">系统运行中</span>
      </div>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex h-screen w-56 flex-shrink-0 flex-col bg-white border-r border-slate-200/80 shadow-sm">
        <Logo />
        <NavLinks pathname={pathname} />
        <StatusDot />
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between bg-white px-4 py-3 border-b border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E8472A]">
            <Droplets className="h-3.5 w-3.5 text-white" />
          </div>
          <p className="text-sm font-bold text-slate-800">污水托管</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="rounded-lg p-1.5 hover:bg-slate-100 transition-colors text-slate-600"
          aria-label="打开菜单"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {open && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
      )}

      <aside className={cn(
        "md:hidden fixed top-0 left-0 z-50 h-screen w-64 flex flex-col bg-white border-r border-slate-200 shadow-xl transition-transform duration-200",
        open ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#E8472A]">
              <Droplets className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 leading-none">污水托管</p>
              <p className="text-[10px] text-slate-400 mt-0.5">WaterOps SaaS</p>
            </div>
          </div>
          <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 hover:bg-slate-100 text-slate-500">
            <X className="h-4 w-4" />
          </button>
        </div>
        <NavLinks pathname={pathname} onClose={() => setOpen(false)} />
        <StatusDot />
      </aside>
    </>
  );
}
