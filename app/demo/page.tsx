"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, CloudRain, AlertCircle, RefreshCw, Activity, BookOpen, ArrowRight } from "lucide-react";
import Link from "next/link";

interface DemoAction {
  id: string;
  icon: React.ElementType;
  label: string;
  desc: string;
  color: string;
  badgeColor: string;
  badge: string;
}

const actions: DemoAction[] = [
  {
    id: "normal",
    icon: Activity,
    label: "推送正常数据",
    desc: "模拟一组稳定运行状态的传感器读数（pH 7.15 / DO 2.65 / ORP 115 / 流量 16.2），可在总览页实时看到数值更新。",
    color: "bg-blue-50 border-blue-200 hover:bg-blue-100",
    badgeColor: "border-blue-200 text-blue-600",
    badge: "正常",
  },
  {
    id: "storm",
    icon: CloudRain,
    label: "触发暴雨冲击",
    desc: "模拟暴雨事件：进水流量飙升至 42.5 m³/h（设计值 2.8×），DO 骤降至 0.6 mg/L。告警中心将自动弹出告警并附带 AI 诊断建议。",
    color: "bg-yellow-50 border-yellow-200 hover:bg-yellow-100",
    badgeColor: "border-yellow-300 text-yellow-700",
    badge: "WARNING",
  },
  {
    id: "fault",
    icon: AlertCircle,
    label: "触发传感器故障",
    desc: "模拟 pH 探头断线故障：读数跳至 14.0（超出物理量程），健康评分降至 20%，系统自动判定为 CRITICAL 告警。",
    color: "bg-red-50 border-red-200 hover:bg-red-100",
    badgeColor: "border-red-200 text-red-600",
    badge: "CRITICAL",
  },
  {
    id: "reset",
    icon: RefreshCw,
    label: "重置演示数据",
    desc: "关闭所有未处理告警，将所有传感器恢复至正常值，站点状态重置为【在线】。演示结束或重新开始前使用。",
    color: "bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:bg-slate-800",
    badgeColor: "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400",
    badge: "重置",
  },
];

const quickLinks = [
  { href: "/dashboard", label: "总览", desc: "查看站点实时状态" },
  { href: "/alerts", label: "告警中心", desc: "处理触发的告警" },
  { href: "/stations", label: "实时监控", desc: "传感器趋势图表" },
  { href: "/docs", label: "硬件指南", desc: "查看接入方案" },
];

export default function DemoPage() {
  const [results, setResults] = useState<Record<string, { ok: boolean; message: string } | null>>({});
  const [loading, setLoading] = useState<string | null>(null);

  async function run(actionId: string) {
    setLoading(actionId);
    const res = await fetch("/api/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: actionId }),
    });
    const data = await res.json();
    setResults(prev => ({ ...prev, [actionId]: data }));
    setLoading(null);
  }

  return (
    <div className="p-6 max-w-3xl space-y-8">
      {/* 头部 */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 p-6 text-white">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">演示控制台</h1>
            <p className="text-blue-100 mt-1 text-sm">
              欢迎体验污水托管运营平台 · 无需真实硬件即可完整演示所有功能
            </p>
          </div>
          <Badge className="bg-white dark:bg-slate-900/20 text-white border-white/30 text-xs">
            演示模式
          </Badge>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-3">
          {quickLinks.map(l => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-xl bg-white dark:bg-slate-900/10 hover:bg-white dark:bg-slate-900/20 transition-colors p-3 flex flex-col gap-1"
            >
              <span className="text-sm font-medium flex items-center gap-1">
                {l.label} <ArrowRight className="h-3 w-3" />
              </span>
              <span className="text-[11px] text-blue-100">{l.desc}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* 演示步骤建议 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            推荐演示路径（约 5 分钟）
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
            {[
              "点击下方【推送正常数据】，然后打开【总览】页面，观察传感器数值实时更新",
              "点击【触发暴雨冲击】，切换到【告警中心】查看自动生成的告警与 AI 诊断建议",
              "在告警中心点击【确认】或【解决】操作一条告警，体验工单联动",
              "打开【实时监控】，选择任意传感器查看历史趋势图（过去 24 小时数据）",
              "前往【控制下发】，调节曝气风机频率，观察安全限幅保护机制",
              "在【化验记录】录入一条人工化验数据，然后前往【运营报表】生成本月月报",
              "演示结束后点击【重置演示数据】，恢复初始状态",
            ].map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex-shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-xs font-bold">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* 操作按钮 */}
      <div>
        <h2 className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-3">场景触发</h2>
        <div className="space-y-3">
          {actions.map(action => {
            const Icon = action.icon;
            const result = results[action.id];
            return (
              <div key={action.id} className={`rounded-xl border p-4 transition-colors ${action.color}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="mt-0.5 rounded-lg bg-white dark:bg-slate-900 p-1.5 shadow-sm flex-shrink-0">
                      <Icon className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{action.label}</p>
                        <Badge variant="outline" className={`text-[10px] ${action.badgeColor}`}>
                          {action.badge}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{action.desc}</p>
                      {result && (
                        <p className={`text-xs mt-1.5 flex items-center gap-1 ${result.ok ? "text-green-600" : "text-red-500"}`}>
                          <CheckCircle2 className="h-3 w-3" />
                          {result.message}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-shrink-0 bg-white dark:bg-slate-900 h-8 text-xs"
                    disabled={loading === action.id}
                    onClick={() => run(action.id)}
                  >
                    {loading === action.id ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : "执行"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-center text-slate-400 dark:text-slate-500">
        数据模拟器每 10 秒自动推送传感器数据 · 演示数据不会上传至任何外部系统
      </p>
    </div>
  );
}
