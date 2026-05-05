"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";

// 不需要侧边栏的页面前缀
const BARE_PATHS = ["/login"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare = BARE_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (bare) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#EEF0F5] dark:bg-slate-950">
      <Sidebar />
      <main className="flex-1 overflow-y-auto pt-12 md:pt-0">{children}</main>
    </div>
  );
}
