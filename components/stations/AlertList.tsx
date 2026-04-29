"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { CheckCheck, AlertTriangle, AlertCircle, Info } from "lucide-react";

interface Alert {
  id: string;
  type: string;
  severity: string;
  message: string;
  diagnosis: string | null;
  status: string;
  triggeredAt: string;
  sensor?: { type: string; name: string; unit: string } | null;
  workOrders?: { id: string; status: string; title: string }[];
}

interface AlertListProps {
  stationId: string;
  initialAlerts: Alert[];
}

const severityConfig = {
  INFO: { icon: Info, color: "text-blue-500", bg: "bg-blue-50", badge: "border-blue-200 text-blue-700" },
  WARNING: { icon: AlertTriangle, color: "text-yellow-500", bg: "bg-yellow-50", badge: "border-yellow-200 text-yellow-700" },
  CRITICAL: { icon: AlertCircle, color: "text-red-500", bg: "bg-red-50", badge: "border-red-200 text-red-700" },
};

const statusLabel: Record<string, string> = {
  OPEN: "待处理",
  ACKNOWLEDGED: "已确认",
  RESOLVED: "已解决",
};

export function AlertList({ stationId, initialAlerts }: AlertListProps) {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [loading, setLoading] = useState<string | null>(null);

  async function handleAction(alertId: string, action: "acknowledge" | "resolve") {
    setLoading(alertId);
    await fetch(`/api/stations/${stationId}/alerts`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alertId, action }),
    });

    setAlerts((prev) =>
      prev.map((a) =>
        a.id === alertId
          ? {
              ...a,
              status: action === "resolve" ? "RESOLVED" : "ACKNOWLEDGED",
            }
          : a
      )
    );
    setLoading(null);
  }

  if (alerts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
        暂无告警记录
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {alerts.map((alert) => {
        const cfg = severityConfig[alert.severity as keyof typeof severityConfig] ?? severityConfig.INFO;
        const Icon = cfg.icon;

        return (
          <div
            key={alert.id}
            className={`rounded-xl border p-4 ${alert.status === "RESOLVED" ? "opacity-60" : ""}`}
          >
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 rounded-lg p-1.5 ${cfg.bg}`}>
                <Icon className={`h-4 w-4 ${cfg.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {alert.message}
                  </p>
                  <Badge variant="outline" className={`text-[10px] ${cfg.badge}`}>
                    {alert.severity}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] text-slate-500">
                    {statusLabel[alert.status]}
                  </Badge>
                </div>

                {alert.diagnosis && (
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {alert.diagnosis}
                  </p>
                )}

                <p className="text-[11px] text-slate-400 mt-1.5">
                  {formatDistanceToNow(new Date(alert.triggeredAt), {
                    locale: zhCN,
                    addSuffix: true,
                  })}
                  {alert.sensor && ` · ${alert.sensor.name}`}
                </p>
              </div>

              {/* 操作按钮 */}
              {alert.status === "OPEN" && (
                <div className="flex gap-1.5 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={loading === alert.id}
                    onClick={() => handleAction(alert.id, "acknowledge")}
                  >
                    确认
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs text-green-700 border-green-200 hover:bg-green-50"
                    disabled={loading === alert.id}
                    onClick={() => handleAction(alert.id, "resolve")}
                  >
                    <CheckCheck className="h-3 w-3 mr-1" />
                    解决
                  </Button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
