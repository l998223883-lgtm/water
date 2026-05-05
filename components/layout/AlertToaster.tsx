"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, AlertTriangle, X } from "lucide-react";

interface Toast {
  id: string;
  alertId: string;
  stationId: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  message: string;
}

export function AlertToaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const router = useRouter();

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const es = new EventSource("/api/events/alerts");
    es.addEventListener("ww", (e) => {
      const ev = JSON.parse((e as MessageEvent).data);
      if (ev.type !== "alert.created") {
        // 状态变更也触发服务端组件刷新（让告警列表更新）
        router.refresh();
        return;
      }
      const id = `${ev.alertId}-${Date.now()}`;
      setToasts((prev) => [
        ...prev,
        {
          id,
          alertId: ev.alertId,
          stationId: ev.stationId,
          severity: ev.severity,
          message: ev.message,
        },
      ]);
      // 7 秒自动消失
      setTimeout(() => dismiss(id), 7000);
      // 触发服务端组件重新拉取，让 dashboard / alerts 列表更新
      router.refresh();
    });

    es.onerror = () => {
      console.warn("[AlertToaster] SSE connection error, browser will reconnect");
    };
    return () => es.close();
  }, [router, dismiss]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => {
        const isCritical = t.severity === "CRITICAL";
        return (
          <div
            key={t.id}
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm animate-in slide-in-from-right ${
              isCritical
                ? "bg-red-50/95 dark:bg-red-950/80 border-red-200 dark:border-red-900 text-red-900 dark:text-red-100"
                : "bg-amber-50/95 dark:bg-amber-950/80 border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-100"
            }`}
            role="alert"
          >
            <div className="mt-0.5 flex-shrink-0">
              {isCritical ? <AlertCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
                {isCritical ? "严重告警" : "新告警"}
              </p>
              <p className="text-sm font-medium mt-0.5">{t.message}</p>
              <a
                href={`/alerts?station=${t.stationId}`}
                className="text-xs underline mt-1 inline-block"
              >
                查看详情
              </a>
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="flex-shrink-0 opacity-60 hover:opacity-100"
              aria-label="关闭"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
