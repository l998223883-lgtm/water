import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { SensorChart } from "@/components/stations/SensorChart";
import { AlertList } from "@/components/stations/AlertList";
import { SensorValueCard } from "@/components/dashboard/SensorValueCard";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { predictSoftMeasure, getControlRecommendation } from "@/lib/placeholders";
import { ArrowLeft, Wifi, WifiOff } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

export const dynamic = "force-dynamic";

const SENSOR_COLORS: Record<string, string> = {
  PH: "#8b5cf6",
  DO: "#3b82f6",
  ORP: "#f59e0b",
  FLOW_IN: "#10b981",
  TURBIDITY: "#6366f1",
  TEMP: "#ef4444",
};

async function getStation(id: string) {
  return prisma.station.findUnique({
    where: { id },
    include: {
      sensors: { where: { isActive: true }, orderBy: { type: "asc" } },
      alerts: {
        orderBy: { triggeredAt: "desc" },
        take: 30,
        include: {
          sensor: { select: { type: true, name: true, unit: true } },
          workOrders: { select: { id: true, status: true, title: true } },
        },
      },
      controlLogs: {
        orderBy: { issuedAt: "desc" },
        take: 10,
      },
      softModels: true,
    },
  });
}

export default async function StationPage({
  params,
}: {
  params: { id: string };
}) {
  const station = await getStation(params.id);
  if (!station) notFound();

  const sensorMap = Object.fromEntries(station.sensors.map((s) => [s.type, s]));
  const snapshot = {
    ph: sensorMap["PH"]?.lastValue ?? 7.0,
    do: sensorMap["DO"]?.lastValue ?? 2.0,
    orp: sensorMap["ORP"]?.lastValue ?? 80,
    flowIn: sensorMap["FLOW_IN"]?.lastValue ?? 10,
  };
  const soft = predictSoftMeasure(snapshot);
  const control = getControlRecommendation(snapshot, station.capacity);

  const isOnline = station.status === "ONLINE";
  const heartbeatAge = station.lastHeartbeat
    ? formatDistanceToNow(new Date(station.lastHeartbeat), { locale: zhCN, addSuffix: true })
    : "从未连接";

  const openAlerts = station.alerts.filter((a) => a.status === "OPEN");

  return (
    <div className="p-6 space-y-5">
      {/* 顶部导航 */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/dashboard"
            className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:text-slate-300 mb-2"
          >
            <ArrowLeft className="h-3 w-3" />
            返回总览
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
              {station.name}
            </h1>
            <Badge
              variant="outline"
              className={isOnline ? "border-green-200 text-green-700 bg-green-50" : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400"}
            >
              {isOnline ? "在线" : "离线"}
            </Badge>
            {openAlerts.length > 0 && (
              <Badge variant="outline" className="border-red-200 text-red-600 bg-red-50">
                {openAlerts.length} 条告警
              </Badge>
            )}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {station.location} · {station.processType} · 设计 {station.capacity} 吨/天
          </p>
        </div>

        <div className="text-right text-xs text-slate-400 dark:text-slate-500">
          <div className="flex items-center gap-1 justify-end">
            {isOnline
              ? <Wifi className="h-3 w-3 text-green-500" />
              : <WifiOff className="h-3 w-3" />}
            <span>{heartbeatAge}</span>
          </div>
          <p className="mt-0.5">网关: {station.gatewayId ?? "未配置"}</p>
        </div>
      </div>

      {/* 传感器当前值 */}
      <div className="grid grid-cols-4 gap-3">
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

      {/* 软测量 + 控制建议 */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-200">
              软测量预测
              <span className="ml-2 text-[10px] font-normal text-slate-400 dark:text-slate-500">
                本地推理 · {soft.source === "fallback" ? "经验公式 [PLACEHOLDER: 接入LightGBM后精度更高]" : "LightGBM ONNX"}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-6">
              <div>
                <p className="text-2xl font-bold tabular-nums">{soft.codOut}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">出水COD mg/L</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">目标 &lt;50 (一级A)</p>
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{soft.nh3nOut}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">出水氨氮 mg/L</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">目标 &lt;5 (一级A)</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-400 dark:text-slate-500 tabular-nums">
                  {(soft.confidence * 100).toFixed(0)}%
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">置信度</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-200">
              控制建议
              <span className="ml-2 text-[10px] font-normal text-slate-400 dark:text-slate-500">
                本地模糊控制 · 只读建议模式
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-6">
              <div>
                <p className={`text-2xl font-bold tabular-nums ${control.safetyTriggered ? "text-orange-600" : ""}`}>
                  {control.blowerHz} Hz
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">建议鼓风机频率</p>
                {control.safetyTriggered && (
                  <p className="text-[10px] text-orange-500">⚠ 保底防线已触发</p>
                )}
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{control.dosingRatePct}%</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">建议加药泵开度</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">{control.reason}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: 曲线 / 告警 / 控制日志 */}
      <Tabs defaultValue="charts">
        <TabsList>
          <TabsTrigger value="charts">历史曲线</TabsTrigger>
          <TabsTrigger value="alerts">
            告警记录
            {openAlerts.length > 0 && (
              <span className="ml-1.5 rounded-full bg-red-500 text-white text-[10px] px-1.5 py-0.5">
                {openAlerts.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="control">控制日志</TabsTrigger>
        </TabsList>

        <TabsContent value="charts" className="mt-4 grid grid-cols-2 gap-4">
          {station.sensors.map((sensor) => (
            <SensorChart
              key={sensor.id}
              stationId={station.id}
              sensorType={sensor.type}
              sensorName={sensor.name}
              unit={sensor.unit}
              minNormal={sensor.minNormal}
              maxNormal={sensor.maxNormal}
              color={SENSOR_COLORS[sensor.type] ?? "#3b82f6"}
            />
          ))}
        </TabsContent>

        <TabsContent value="alerts" className="mt-4">
          <AlertList
            stationId={station.id}
            initialAlerts={station.alerts.map((a) => ({
              ...a,
              triggeredAt: a.triggeredAt.toISOString(),
            }))}
          />
        </TabsContent>

        <TabsContent value="control" className="mt-4">
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/40 text-xs text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2.5 text-left">时间</th>
                  <th className="px-4 py-2.5 text-left">设备</th>
                  <th className="px-4 py-2.5 text-left">参数</th>
                  <th className="px-4 py-2.5 text-right">原值</th>
                  <th className="px-4 py-2.5 text-right">新值</th>
                  <th className="px-4 py-2.5 text-left">来源</th>
                  <th className="px-4 py-2.5 text-left">回执</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {station.controlLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:bg-slate-900/40">
                    <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 text-xs">
                      {new Date(log.issuedAt).toLocaleString("zh-CN")}
                    </td>
                    <td className="px-4 py-2.5 font-medium">
                      {log.device === "BLOWER" ? "鼓风机" : "加药泵"}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{log.parameter}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{log.oldValue}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                      {log.newValue}
                      {log.clampedFrom && (
                        <span className="text-orange-500 text-[10px] ml-1">
                          (截断自{log.clampedFrom})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          log.source === "SAFETY"
                            ? "border-orange-200 text-orange-600"
                            : log.source === "MANUAL"
                            ? "border-blue-200 text-blue-600"
                            : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {log.source === "SAFETY" ? "保底防线" : log.source === "MANUAL" ? "人工" : "算法"}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      {log.confirmedAt ? (
                        <span className="text-green-600">✓ 已确认</span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500">等待中</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
