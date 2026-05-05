"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FlaskConical, Plus, CheckCircle2 } from "lucide-react";

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

interface LabFormProps {
  stationId: string;
  initialSamples: LabSample[];
}

const GB_LIMITS = { codOut: 50, nh3nOut: 5, tpOut: 0.5, ssOut: 10 };

const FIELDS = [
  { key: "codOut",  label: "出水COD",  unit: "mg/L", limit: GB_LIMITS.codOut,  step: 1,   placeholder: "≤50" },
  { key: "nh3nOut", label: "出水氨氮", unit: "mg/L", limit: GB_LIMITS.nh3nOut, step: 0.1, placeholder: "≤5" },
  { key: "tpOut",   label: "出水总磷", unit: "mg/L", limit: GB_LIMITS.tpOut,   step: 0.01,placeholder: "≤0.5" },
  { key: "ssOut",   label: "出水SS",   unit: "mg/L", limit: GB_LIMITS.ssOut,   step: 1,   placeholder: "≤10" },
  { key: "codIn",   label: "进水COD",  unit: "mg/L", limit: null,              step: 1,   placeholder: "进水水质" },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"];

export function LabForm({ stationId, initialSamples }: LabFormProps) {
  const [samples, setSamples] = useState(initialSamples);
  const [form, setForm] = useState<Partial<Record<FieldKey | "sampledAt" | "notes", string>>>({
    sampledAt: new Date().toISOString().slice(0, 10),
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  function handleChange(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSuccess(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.sampledAt) return;
    setSubmitting(true);

    const body = {
      stationId,
      sampledAt: form.sampledAt,
      codOut: form.codOut ? parseFloat(form.codOut) : null,
      nh3nOut: form.nh3nOut ? parseFloat(form.nh3nOut) : null,
      tpOut: form.tpOut ? parseFloat(form.tpOut) : null,
      ssOut: form.ssOut ? parseFloat(form.ssOut) : null,
      codIn: form.codIn ? parseFloat(form.codIn) : null,
      notes: form.notes ?? null,
    };

    try {
      const res = await fetch("/api/lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        alert(`录入失败 (${res.status}): ${msg || "请检查输入后重试"}`);
        return;
      }
      const sample = await res.json();
      setSamples((prev) => [{ ...sample, sampledAt: sample.sampledAt, createdAt: sample.createdAt }, ...prev]);
      setForm({ sampledAt: new Date().toISOString().slice(0, 10) });
      setSuccess(true);
    } catch (err) {
      alert(`网络错误: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* 录入表单 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FlaskConical className="h-3.5 w-3.5 text-purple-500" />
            新增化验记录
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">采样日期 *</label>
                <input
                  type="date"
                  required
                  value={form.sampledAt ?? ""}
                  onChange={(e) => handleChange("sampledAt", e.target.value)}
                  className="w-full rounded-md border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">备注</label>
                <input
                  type="text"
                  value={form.notes ?? ""}
                  onChange={(e) => handleChange("notes", e.target.value)}
                  placeholder="可选，如采样位置/天气等"
                  className="w-full rounded-md border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-5 gap-3">
              {FIELDS.map((f) => {
                const val = form[f.key];
                const num = val ? parseFloat(val) : null;
                const overLimit = f.limit !== null && num !== null && num > f.limit;
                return (
                  <div key={f.key}>
                    <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">
                      {f.label}
                      <span className="text-slate-400 dark:text-slate-500 ml-1">({f.unit})</span>
                    </label>
                    <input
                      type="number"
                      step={f.step}
                      min={0}
                      value={val ?? ""}
                      onChange={(e) => handleChange(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      className={`w-full rounded-md border px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        overLimit ? "border-red-300 bg-red-50" : "border-slate-200 dark:border-slate-700"
                      }`}
                    />
                    {overLimit && (
                      <p className="text-[10px] text-red-500 mt-0.5">超GB18918一级A标准</p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={submitting} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                {submitting ? "提交中..." : "录入"}
              </Button>
              {success && (
                <span className="flex items-center gap-1 text-sm text-green-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  录入成功，已加入软测量校准队列
                </span>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* 历史记录 */}
      <div>
        <h2 className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">历史化验记录</h2>
        {samples.length > 0 ? (
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/40 text-xs text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2.5 text-left">采样日期</th>
                  {FIELDS.map((f) => (
                    <th key={f.key} className="px-4 py-2.5 text-right">
                      {f.label}
                    </th>
                  ))}
                  <th className="px-4 py-2.5 text-left">备注</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {samples.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 dark:bg-slate-900/40">
                    <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 text-xs">
                      {new Date(s.sampledAt).toLocaleDateString("zh-CN")}
                    </td>
                    {FIELDS.map((f) => {
                      const val = s[f.key as keyof LabSample] as number | null;
                      const over = f.limit !== null && val !== null && val > f.limit;
                      return (
                        <td
                          key={f.key}
                          className={`px-4 py-2.5 text-right tabular-nums font-medium ${over ? "text-red-600" : ""}`}
                        >
                          {val ?? "—"}
                        </td>
                      );
                    })}
                    <td className="px-4 py-2.5 text-xs text-slate-400 dark:text-slate-500">{s.notes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 py-8 text-center text-xs text-slate-400 dark:text-slate-500">
            暂无化验记录
          </div>
        )}
      </div>
    </div>
  );
}
