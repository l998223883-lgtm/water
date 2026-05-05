import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ControlPanel } from "@/components/control/ControlPanel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getControlRecommendation } from "@/lib/placeholders";
import { ArrowLeft, Shield, AlertTriangle } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";
 // 控制页不缓存

async function getStationForControl(id: string) {
  return prisma.station.findUnique({
    where: { id },
    include: {
      sensors: { where: { isActive: true } },
      controlLogs: {
        orderBy: { issuedAt: "desc" },
        take: 15,
      },
    },
  });
}

export default async function ControlPage({
  params,
}: {
  params: { id: string };
}) {
  const station = await getStationForControl(params.id);
  if (!station) notFound();

  const sensorMap = Object.fromEntries(station.sensors.map((s) => [s.type, s]));
  const snapshot = {
    ph: sensorMap["PH"]?.lastValue ?? 7.0,
    do: sensorMap["DO"]?.lastValue ?? 2.0,
    orp: sensorMap["ORP"]?.lastValue ?? 80,
    flowIn: sensorMap["FLOW_IN"]?.lastValue ?? 10,
  };
  const rec = getControlRecommendation(snapshot, station.capacity);

  // 从控制日志取最后确认的实际运行值
  const lastBlower = station.controlLogs.find((l) => l.device === "BLOWER");
  const lastDosing = station.controlLogs.find((l) => l.device === "DOSING_PUMP");
  const currentBlowerHz = lastBlower?.newValue ?? 35;
  const currentDosingPct = lastDosing?.newValue ?? 50;

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      {/* 顶部 */}
      <div>
        <Link
          href={`/stations/${station.id}`}
          className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:text-slate-300 mb-2"
        >
          <ArrowLeft className="h-3 w-3" />
          返回站点详情
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">控制下发</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{station.name}</p>
          </div>
          <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50 gap-1">
            <Shield className="h-3 w-3" />
            三道保底防线已启用
          </Badge>
        </div>
      </div>

      {/* 安全说明 */}
      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700 space-y-1">
        <div className="flex items-center gap-1.5 font-medium">
          <Shield className="h-3.5 w-3.5" />
          保底防线说明（MVP阶段：日志记录，不实际发送至网关）
        </div>
        <div className="grid grid-cols-3 gap-2 mt-1.5 text-blue-600">
          <div className="flex items-start gap-1">
            <span className="font-mono">①</span>
            <span>硬限幅：鼓风机 20–50Hz，加药泵 10–90%，超限自动截断</span>
          </div>
          <div className="flex items-start gap-1">
            <span className="font-mono">②</span>
            <span>变化率限制：单次最大变化 ≤30%，防止设备突变</span>
          </div>
          <div className="flex items-start gap-1">
            <span className="font-mono">③</span>
            <span>回执确认：网关接收后返回 ACK，超时未确认触发告警</span>
          </div>
        </div>
      </div>

      {/* 控制面板 */}
      <div className="grid grid-cols-2 gap-4">
        <ControlPanel
          stationId={station.id}
          device="BLOWER"
          label="鼓风机变频控制"
          parameter="frequency_hz"
          unit="Hz"
          min={0}
          max={60}
          safetyMin={20}
          safetyMax={50}
          currentValue={currentBlowerHz}
          recommended={rec.blowerHz}
        />
        <ControlPanel
          stationId={station.id}
          device="DOSING_PUMP"
          label="加药泵开度控制"
          parameter="dose_rate_pct"
          unit="%"
          min={0}
          max={100}
          safetyMin={10}
          safetyMax={90}
          currentValue={currentDosingPct}
          recommended={rec.dosingRatePct}
        />
      </div>

      {/* 算法建议说明 */}
      {rec.safetyTriggered && (
        <div className="flex items-start gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">算法建议已触发保底防线</p>
            <p className="text-xs mt-0.5">{rec.reason}</p>
          </div>
        </div>
      )}
      {!rec.safetyTriggered && (
        <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
          <span className="font-medium text-slate-600 dark:text-slate-300">算法建议说明：</span> {rec.reason}
          <span className="ml-2 text-slate-400 dark:text-slate-500">（本地模糊控制，{snapshot.do} mg/L DO，流量 {snapshot.flowIn} m³/h）</span>
        </div>
      )}

      {/* 控制日志 */}
      <div>
        <h2 className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-3">最近控制日志</h2>
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/40 text-xs text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2.5 text-left">时间</th>
                <th className="px-4 py-2.5 text-left">设备</th>
                <th className="px-4 py-2.5 text-right">原值</th>
                <th className="px-4 py-2.5 text-right">下发值</th>
                <th className="px-4 py-2.5 text-left">来源</th>
                <th className="px-4 py-2.5 text-left">回执</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {station.controlLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 dark:bg-slate-900/40">
                  <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 text-xs">
                    {new Date(log.issuedAt).toLocaleString("zh-CN", {
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-sm">
                    {log.device === "BLOWER" ? "🌀 鼓风机" : "💉 加药泵"}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-500 dark:text-slate-400">
                    {log.oldValue}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                    {log.newValue}
                    {log.clampedFrom !== null && (
                      <span className="ml-1 text-[10px] text-orange-500 font-normal">
                        ← {log.clampedFrom}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        log.source === "SAFETY"
                          ? "border-orange-200 text-orange-600 bg-orange-50"
                          : log.source === "MANUAL"
                          ? "border-blue-200 text-blue-600 bg-blue-50"
                          : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {log.source === "SAFETY" ? "⚡ 保底防线" : log.source === "MANUAL" ? "👤 人工" : "🤖 算法"}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    {log.confirmedAt ? (
                      <span className="text-green-600">✓ 已确认</span>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500">
                        {/* PLACEHOLDER: 真实环境等待 MQTT ACK */}
                        待回执
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {station.controlLogs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500 text-sm">
                    暂无控制记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
