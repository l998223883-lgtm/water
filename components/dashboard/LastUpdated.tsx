"use client";

import { useEffect, useState } from "react";

export function LastUpdated() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1 leading-none">
        {now ? now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : "--:--"}
      </p>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
        {now ? now.toLocaleDateString("zh-CN", { month: "long", day: "numeric" }) : ""}
      </p>
    </>
  );
}
