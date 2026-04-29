"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, RefreshCw, FlaskConical, Sparkles } from "lucide-react";
import { format, subMonths } from "date-fns";
import { zhCN } from "date-fns/locale";

interface Report {
  id: string;
  month: string;
  summary: string | null;
  metrics: Record<string, number | null>;
  createdAt: string;
}

interface LabSample {
  id: string;
  sampledAt: string;
  codOut: number | null;
  nh3nOut: number | null;
  tpOut: number | null;
  ssOut: number | null;
  codIn: number | null;
  notes: string | null;
}

interface ReportViewerProps {
  stationId: string;
  initialReports: Report[];
  labSamples: LabSample[];
}

const GB_LIMITS = { cod: 50, nh3n: 5, tp: 0.5, ss: 10 };

function MonthSelector({
  selected,
  onChange,
}: {
  selected: string;
  onChange: (m: string) => void;
}) {
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    months.push(format(subMonths(now, i), "yyyy-MM"));
  }
  return (
    <div className="flex gap-1.5 flex-wrap">
      {months.map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${
            m === selected
              ? "bg-blue-600 text-white"
              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          {format(new Date(m + "-01"), "yyyy年M月", { locale: zhCN })}
        </button>
      ))}
    </div>
  );
}

export function ReportViewer({
  stationId,
  initialReports,
  labSamples,
}: ReportViewerProps) {
  const currentMonth = format(new Date(), "yyyy-MM");
  const [selectedMonth, setSelectedMonth] = useState(
    initialReports[0]?.month ?? currentMonth
  );
  const [reports, setReports] = useState(initialReports);
  const [generating, setGenerating] = useState(false);

  const report = reports.find((r) => r.month === selectedMonth);

  async function generateReport() {
    setGenerating(true);
    const res = await fetch(`/api/stations/${stationId}/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: selectedMonth }),
    });
    const data = await res.json();
    setReports((prev) => {
      const idx = prev.findIndex((r) => r.month === selectedMonth);
      const newReports = [...prev];
      const formatted = { ...data, metrics: data.metrics as Record<string, number | null> };
      if (idx >= 0) newReports[idx] = formatted;
      else newReports.unshift(formatted);
      return newReports;
    });
    setGenerating(false);
  }

  const m = report?.metrics ?? {};

  return (
    <div className="space-y-4">
      {/* 月份选择 */}
      <div className="flex items-center justify-between">
        <MonthSelector selected={selectedMonth} onChange={setSelectedMonth} />
        <Button
          size="sm"
          variant={report ? "outline" : "default"}
          onClick={generateReport}
          disabled={generating}
          className="gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${generating ? "animate-spin" : ""}`} />
          {report ? "重新生成" : "生成报表"}
        </Button>
      </div>

      {report ? (
        <>
          {/* AI 摘要 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                执行摘要
                <Badge variant="outline" className="text-[10px] text-slate-400 ml-1">
                  {/* PLACEHOLDER: P1接入 Claude Haiku 后显示 "AI生成" */}
                  模板生成 [PLACEHOLDER]
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 leading-relaxed">{report.summary}</p>
            </CardContent>
          </Card>

          {/* 运行指标 */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "系统在线率", value: m.uptime != null ? `${m.uptime}%` : "—", ok: (m.uptime ?? 0) >= 95 },
              { label: "出水COD达标率", value: m.codCompliance != null ? `${m.codCompliance}%` : "—", ok: (m.codCompliance ?? 0) >= 90 },
              { label: "告警次数", value: m.alertCount != null ? `${m.alertCount} 次` : "—", ok: (m.alertCount ?? 99) < 10 },
              { label: "平均DO", value: m.avgDo != null ? `${m.avgDo} mg/L` : "—", ok: (m.avgDo ?? 0) >= 1.5 },
            ].map(({ label, value, ok }) => (
              <Card key={label}>
                <CardContent className="pt-4">
                  <p className={`text-2xl font-bold ${ok ? "text-slate-800" : "text-red-600"}`}>
                    {value}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{label}</p>
                  <div className={`mt-1.5 h-1 rounded-full ${ok ? "bg-green-400" : "bg-red-400"}`} />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* PLACEHOLDER 指标 */}
          <div className="rounded-xl border border-dashed border-slate-200 px-4 py-3 grid grid-cols-3 gap-4 text-sm">
            {[
              { label: "月耗电量", value: m.energyKwh, unit: "kWh", placeholder: "接电表后自动填入" },
              { label: "PAC药耗", value: m.pacKg, unit: "kg", placeholder: "接药耗系统后填入" },
              { label: "化验次数", value: m.labSampleCount, unit: "次", placeholder: null },
            ].map(({ label, value, unit, placeholder }) => (
              <div key={label}>
                <p className="text-xs text-slate-400">{label}</p>
                {value != null ? (
                  <p className="font-semibold text-slate-700">{value} {unit}</p>
                ) : (
                  <p className="text-slate-300 text-xs">{placeholder}</p>
                )}
              </div>
            ))}
          </div>

          <p className="text-xs text-slate-400 text-right">
            报表生成时间: {new Date(report.createdAt).toLocaleString("zh-CN")}
          </p>
        </>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-slate-200 py-16 text-center">
          <FileText className="h-8 w-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500">
            {format(new Date(selectedMonth + "-01"), "yyyy年M月", { locale: zhCN })} 暂无报表
          </p>
          <p className="text-xs text-slate-400 mt-1">点击"生成报表"自动汇总本月运行数据</p>
        </div>
      )}

      {/* 化验记录 */}
      <div>
        <h2 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
          <FlaskConical className="h-3.5 w-3.5 text-purple-500" />
          化验记录（软测量校准数据）
        </h2>
        {labSamples.length > 0 ? (
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 text-left">采样时间</th>
                  <th className="px-4 py-2.5 text-right">
                    出水COD <span className="font-normal">(目标&lt;{GB_LIMITS.cod})</span>
                  </th>
                  <th className="px-4 py-2.5 text-right">
                    氨氮 <span className="font-normal">(&lt;{GB_LIMITS.nh3n})</span>
                  </th>
                  <th className="px-4 py-2.5 text-right">
                    总磷 <span className="font-normal">(&lt;{GB_LIMITS.tp})</span>
                  </th>
                  <th className="px-4 py-2.5 text-right">
                    SS <span className="font-normal">(&lt;{GB_LIMITS.ss})</span>
                  </th>
                  <th className="px-4 py-2.5 text-left">备注</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {labSamples.map((s) => {
                  const codOk = s.codOut == null || s.codOut <= GB_LIMITS.cod;
                  const nh3nOk = s.nh3nOut == null || s.nh3nOut <= GB_LIMITS.nh3n;
                  return (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 text-slate-500 text-xs">
                        {new Date(s.sampledAt).toLocaleDateString("zh-CN")}
                      </td>
                      <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${codOk ? "" : "text-red-600"}`}>
                        {s.codOut ?? "—"}
                      </td>
                      <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${nh3nOk ? "" : "text-red-600"}`}>
                        {s.nh3nOut ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{s.tpOut ?? "—"}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{s.ssOut ?? "—"}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-400">{s.notes ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-xs text-slate-400">
            暂无化验记录 · 在化验记录页录入数据用于软测量校准
          </div>
        )}
      </div>
    </div>
  );
}
