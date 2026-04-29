import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { SensorValueCard } from "@/components/dashboard/SensorValueCard";
import { AlertTriangle, CheckCircle2, Wifi, WifiOff, ArrowUpRight } from "lucide-react";
import { predictSoftMeasure } from "@/lib/placeholders";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { AutoRefresh } from "@/components/layout/AutoRefresh";

export const dynamic = "force-dynamic";

async function getStationData() {
  try {
    return await prisma.station.findMany({
      include: {
        sensors: { where: { isActive: true }, orderBy: { type: "asc" } },
        _count: {
          select: {
            alerts: { where: { status: "OPEN" } },
            workOrders: { where: { status: { in: ["PENDING", "IN_PROGRESS"] } } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  } catch {
    return null;
  }
}

const statusConfig = {
  ONLINE:      { label: "在线",  pill: "bg-green-100 text-green-700" },
  OFFLINE:     { label: "离线",  pill: "bg-slate-100 text-slate-500" },
  MAINTENANCE: { label: "维护中", pill: "bg-amber-100 text-amber-700" },
  ALARM:       { label: "告警",  pill: "bg-red-100 text-red-600" },
};

export default async function DashboardPage() {
  const stations = await getStationData();

  if (!stations) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <WifiOff className="w-12 h-12 text-slate-300" />
        <h2 className="text-lg font-semibold text-slate-600">数据库未连接</h2>
        <p className="text-sm text-slate-400 max-w-sm">
          请在 Vercel 项目设置中配置 <code className="bg-slate-100 px-1 rounded">DATABASE_URL</code> 环境变量后重新部署。
        </p>
      </div>
    );
  }

  const totalOpen = stations.reduce((s, st) => s + st._count.alerts, 0);
  const onlineCount = stations.filter((s) => s.status === "ONLINE").length;

  return (
    <div className="p-6 space-y-6">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">运营总览</h1>
          <p className="text-sm text-slate-400 mt-0.5">实时监控所有污水处理站运行状态</p>
        </div>
        <AutoRefresh intervalMs={15000} />
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Online stations */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">站点在线</p>
              <p className="text-4xl font-bold text-slate-800 mt-1 leading-none">
                {onlineCount}
                <span className="text-lg font-normal text-slate-300 ml-1">/ {stations.length}</span>
              </p>
            </div>
            <div className="rounded-xl bg-blue-50 p-2.5">
              <Wifi className="h-5 w-5 text-blue-500" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-slate-100">
            <div
              className="h-1.5 rounded-full bg-blue-500 transition-all"
              style={{ width: stations.length ? `${(onlineCount / stations.length) * 100}%` : "0%" }}
            />
          </div>
        </div>

        {/* Alerts */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">未处理告警</p>
              <p className={`text-4xl font-bold mt-1 leading-none ${totalOpen > 0 ? "text-[#E8472A]" : "text-slate-800"}`}>
                {totalOpen}
              </p>
            </div>
            <div className={`rounded-xl p-2.5 ${totalOpen > 0 ? "bg-red-50" : "bg-green-50"}`}>
              {totalOpen > 0
                ? <AlertTriangle className="h-5 w-5 text-[#E8472A]" />
                : <CheckCircle2 className="h-5 w-5 text-green-500" />}
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-4">
            {totalOpen > 0 ? `${totalOpen} 条需要处理` : "所有告警已清除"}
          </p>
        </div>

        {/* Last update */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">最后更新</p>
              <p className="text-2xl font-bold text-slate-800 mt-1 leading-none">
                {new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric" })}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-2.5">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Station cards */}
      <div className="space-y-5">
        {stations.map((station) => {
          const sc = statusConfig[station.status];
          const sensorMap = Object.fromEntries(station.sensors.map((s) => [s.type, s]));
          const isOnline = station.status === "ONLINE";

          const snapshot = {
            ph: sensorMap["PH"]?.lastValue ?? 7.0,
            do: sensorMap["DO"]?.lastValue ?? 2.0,
            orp: sensorMap["ORP"]?.lastValue ?? 80,
            flowIn: sensorMap["FLOW_IN"]?.lastValue ?? 10,
          };
          const soft = predictSoftMeasure(snapshot);

          const heartbeatAge = station.lastHeartbeat
            ? formatDistanceToNow(new Date(station.lastHeartbeat), { locale: zhCN, addSuffix: true })
            : "从未连接";

          return (
            <div key={station.id} className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              {/* Card header */}
              <div className="px-6 pt-5 pb-4 border-b border-slate-100">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-base font-bold text-slate-800">{station.name}</h2>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${sc.pill}`}>
                        {sc.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {station.location} · {station.processType} · 设计 {station.capacity} 吨/天
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1.5 justify-end text-xs text-slate-400">
                      {isOnline
                        ? <Wifi className="h-3.5 w-3.5 text-green-500" />
                        : <WifiOff className="h-3.5 w-3.5 text-slate-300" />}
                      <span>{heartbeatAge}</span>
                    </div>
                    {station._count.alerts > 0 && (
                      <span className="inline-flex items-center mt-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-[#E8472A]">
                        {station._count.alerts} 条告警待处理
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Sensor grid */}
              <div className="px-6 pt-4 pb-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {station.sensors.map((sensor) => (
                    <SensorValueCard
                      key={sensor.id}
                      type={sensor.type}
                      name={sensor.name}
                      value={sensor.lastValue}
                      unit={sensor.unit}
                      minNormal={sensor.minNormal}
                      maxNormal={sensor.maxNormal}
                      healthScore={sensor.healthScore}
                      lastReadAt={sensor.lastReadAt?.toISOString() ?? null}
                    />
                  ))}
                </div>

                {/* Soft measurement bar */}
                <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
                  <div className="flex gap-6 text-sm">
                    <div>
                      <span className="text-slate-400 text-xs">出水 COD 预测</span>
                      <p className={`font-bold text-base leading-tight ${soft.codOut > 50 ? "text-[#E8472A]" : "text-slate-800"}`}>
                        {soft.codOut} <span className="text-xs font-normal text-slate-400">mg/L</span>
                      </p>
                      <p className="text-[10px] text-slate-400">目标 &lt;50</p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-xs">氨氮预测</span>
                      <p className={`font-bold text-base leading-tight ${soft.nh3nOut > 5 ? "text-[#E8472A]" : "text-slate-800"}`}>
                        {soft.nh3nOut} <span className="text-xs font-normal text-slate-400">mg/L</span>
                      </p>
                      <p className="text-[10px] text-slate-400">目标 &lt;5</p>
                    </div>
                    <div className="flex items-center">
                      <span className="text-[11px] text-slate-300 bg-slate-100 rounded-lg px-2 py-1">
                        本地推理 · {soft.source === "fallback" ? "经验公式" : "LightGBM"}
                      </span>
                    </div>
                  </div>
                  <Link
                    href={`/stations/${station.id}`}
                    className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    查看详情 <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {stations.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 p-16 text-center text-slate-400 bg-white">
          <p className="font-semibold">暂无站点数据</p>
          <p className="text-sm mt-1">运行 npm run db:seed 导入演示数据</p>
        </div>
      )}
    </div>
  );
}
