"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

interface AutoRefreshProps {
  intervalMs?: number; // 默认15秒
}

export function AutoRefresh({ intervalMs = 15000 }: AutoRefreshProps) {
  const router = useRouter();
  const [countdown, setCountdown] = useState(intervalMs / 1000);
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const countRef = useRef<ReturnType<typeof setInterval>>();

  function refresh() {
    setRefreshing(true);
    router.refresh();
    setCountdown(intervalMs / 1000);
    setTimeout(() => setRefreshing(false), 600);
  }

  useEffect(() => {
    // 数据刷新
    intervalRef.current = setInterval(refresh, intervalMs);
    // 倒计时
    countRef.current = setInterval(() => {
      setCountdown((c) => (c <= 1 ? intervalMs / 1000 : c - 1));
    }, 1000);
    return () => {
      clearInterval(intervalRef.current);
      clearInterval(countRef.current);
    };
  }, [intervalMs]);

  return (
    <button
      onClick={refresh}
      className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-all shadow-sm"
      title="点击立即刷新"
    >
      <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
      <span>{countdown}s 后刷新</span>
    </button>
  );
}
