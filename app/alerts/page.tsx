import { prisma } from "@/lib/prisma";
import { AlertList } from "@/components/stations/AlertList";
import { Badge } from "@/components/ui/badge";
import { Bell, CheckCircle2, AlertTriangle, AlertCircle } from "lucide-react";

export const revalidate = 30;

async function getAllAlerts() {
  const station = await prisma.station.findFirst({ orderBy: { createdAt: "asc" } });
  if (!station) return { station: null, open: [], acked: [], resolved: [] };

  const all = await prisma.alert.findMany({
    where: { stationId: station.id },
    include: {
      sensor: { select: { type: true, name: true, unit: true } },
      workOrders: { select: { id: true, status: true, title: true } },
    },
    orderBy: { triggeredAt: "desc" },
    take: 100,
  });

  return {
    station,
    open: all.filter((a) => a.status === "OPEN"),
    acked: all.filter((a) => a.status === "ACKNOWLEDGED"),
    resolved: all.filter((a) => a.status === "RESOLVED"),
  };
}

export default async function AlertsPage() {
  const { station, open, acked, resolved } = await getAllAlerts();

  if (!station) {
    return (
      <div className="p-6 text-center text-slate-400">暂无站点数据</div>
    );
  }

  const serialize = (alerts: typeof open) =>
    alerts.map((a) => ({ ...a, triggeredAt: a.triggeredAt.toISOString() }));

  const criticalCount = open.filter((a) => a.severity === "CRITICAL").length;

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      {/* 顶部 */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">告警中心</h1>
          <p className="text-sm text-slate-500 mt-0.5">{station.name}</p>
        </div>
        {/* PLACEHOLDER: P1阶段加入短信/企业微信推送配置入口 */}
        <Badge variant="outline" className="text-slate-400 border-dashed text-xs">
          📱 推送配置（即将上线）
        </Badge>
      </div>

      {/* 统计行 */}
      <div className="grid grid-cols-4 gap-3">
        {[
          {
            label: "待处理",
            count: open.length,
            icon: Bell,
            color: "text-red-500 bg-red-50",
          },
          {
            label: "严重告警",
            count: criticalCount,
            icon: AlertCircle,
            color: "text-red-600 bg-red-50",
          },
          {
            label: "已确认",
            count: acked.length,
            icon: AlertTriangle,
            color: "text-yellow-500 bg-yellow-50",
          },
          {
            label: "已解决",
            count: resolved.length,
            icon: CheckCircle2,
            color: "text-green-500 bg-green-50",
          },
        ].map(({ label, count, icon: Icon, color }) => (
          <div
            key={label}
            className="rounded-xl border bg-white px-4 py-3 flex items-center gap-3"
          >
            <div className={`rounded-lg p-2 ${color.split(" ")[1]}`}>
              <Icon className={`h-4 w-4 ${color.split(" ")[0]}`} />
            </div>
            <div>
              <p className="text-xl font-bold">{count}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* 待处理 */}
      {open.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            待处理 ({open.length})
          </h2>
          <AlertList stationId={station.id} initialAlerts={serialize(open)} />
        </section>
      )}

      {/* 已确认 */}
      {acked.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-yellow-400" />
            已确认 ({acked.length})
          </h2>
          <AlertList stationId={station.id} initialAlerts={serialize(acked)} />
        </section>
      )}

      {/* 已解决 */}
      {resolved.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-slate-500 mb-2 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-400" />
            已解决 ({resolved.length})
          </h2>
          <AlertList stationId={station.id} initialAlerts={serialize(resolved)} />
        </section>
      )}

      {open.length === 0 && acked.length === 0 && resolved.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-slate-200 py-12 text-center text-slate-400">
          <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-400" />
          <p>暂无告警记录</p>
        </div>
      )}
    </div>
  );
}
