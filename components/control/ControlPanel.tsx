"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { AlertTriangle, CheckCircle2, Send, Shield } from "lucide-react";

interface ControlPanelProps {
  stationId: string;
  device: "BLOWER" | "DOSING_PUMP";
  label: string;
  parameter: string;
  unit: string;
  min: number;
  max: number;
  currentValue: number;   // 当前实际运行值（上次下发确认值）
  recommended: number;    // 算法建议值
  safetyMin: number;
  safetyMax: number;
  onSuccess?: (newValue: number) => void;
}

export function ControlPanel({
  stationId,
  device,
  label,
  parameter,
  unit,
  min,
  max,
  currentValue,
  recommended,
  safetyMin,
  safetyMax,
  onSuccess,
}: ControlPanelProps) {
  const [inputValue, setInputValue] = useState(currentValue);
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    applied: number;
    safetyTriggered: boolean;
    safetyNote?: string;
  } | null>(null);

  const delta = Math.abs(inputValue - currentValue);
  const deltaPct = currentValue > 0 ? (delta / currentValue) * 100 : 0;
  const isBeyondSafety = inputValue < safetyMin || inputValue > safetyMax;
  const isLargeChange = deltaPct > 25;

  async function handleSubmit() {
    setLoading(true);
    try {
      const res = await fetch(`/api/stations/${stationId}/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device, value: inputValue, source: "MANUAL" }),
      });
      const data = await res.json();
      setResult({ applied: data.applied, safetyTriggered: data.safetyTriggered, safetyNote: data.safetyNote });
      onSuccess?.(data.applied);
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  }

  const fillPct = ((inputValue - min) / (max - min)) * 100;
  const currentPct = ((currentValue - min) / (max - min)) * 100;
  const recommendedPct = ((recommended - min) / (max - min)) * 100;

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-medium">{label}</CardTitle>
              <p className="text-xs text-slate-400 mt-0.5">{parameter}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-xs text-slate-500">
                安全范围 {safetyMin}–{safetyMax} {unit}
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* 当前值 vs 建议值 */}
          <div className="flex gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-400">当前运行</p>
              <p className="text-xl font-bold tabular-nums">
                {currentValue} <span className="text-xs font-normal text-slate-400">{unit}</span>
              </p>
            </div>
            <div className="flex items-center text-slate-300">→</div>
            <div>
              <p className="text-xs text-slate-400">算法建议</p>
              <p className="text-xl font-bold tabular-nums text-blue-600">
                {recommended} <span className="text-xs font-normal text-slate-400">{unit}</span>
              </p>
            </div>
          </div>

          {/* 可视化滑块条 */}
          <div className="space-y-1">
            <div className="relative h-6 flex items-center">
              {/* 背景条 */}
              <div className="absolute inset-x-0 h-2 rounded-full bg-slate-100" />
              {/* 安全范围区间 */}
              <div
                className="absolute h-2 rounded-full bg-green-100"
                style={{
                  left: `${((safetyMin - min) / (max - min)) * 100}%`,
                  width: `${((safetyMax - safetyMin) / (max - min)) * 100}%`,
                }}
              />
              {/* 当前值标记 */}
              <div
                className="absolute h-3 w-1 rounded-full bg-slate-400"
                style={{ left: `calc(${currentPct}% - 2px)` }}
              />
              {/* 建议值标记 */}
              <div
                className="absolute h-3 w-1 rounded-full bg-blue-500"
                style={{ left: `calc(${recommendedPct}% - 2px)` }}
              />
              {/* 输入值滑块 */}
              <input
                type="range"
                min={min}
                max={max}
                step={device === "BLOWER" ? 1 : 5}
                value={inputValue}
                onChange={(e) => {
                  setInputValue(Number(e.target.value));
                  setResult(null);
                }}
                className="absolute inset-x-0 h-2 w-full cursor-pointer appearance-none bg-transparent"
                style={{
                  // 给 range input 染色
                  background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${fillPct}%, transparent ${fillPct}%, transparent 100%)`,
                }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>{min} {unit}</span>
              <span>{max} {unit}</span>
            </div>
          </div>

          {/* 数字输入 */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-sm text-slate-500">目标值</span>
              <input
                type="number"
                min={min}
                max={max}
                value={inputValue}
                onChange={(e) => {
                  setInputValue(Number(e.target.value));
                  setResult(null);
                }}
                className="w-20 rounded-md border border-slate-200 px-2 py-1 text-sm font-mono text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-500">{unit}</span>
              {deltaPct > 0 && (
                <span className={`text-xs ${isLargeChange ? "text-orange-500" : "text-slate-400"}`}>
                  {inputValue > currentValue ? "+" : ""}{(inputValue - currentValue).toFixed(1)} ({deltaPct.toFixed(0)}%)
                </span>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={() => setInputValue(recommended)}
            >
              用建议值
            </Button>
          </div>

          {/* 警告提示 */}
          {isBeyondSafety && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              <span>超出安全范围，系统将自动截断至 {safetyMin}–{safetyMax} {unit}</span>
            </div>
          )}
          {isLargeChange && !isBeyondSafety && (
            <div className="flex items-start gap-2 rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-2 text-xs text-yellow-700">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              <span>变化幅度较大（{deltaPct.toFixed(0)}%），系统可能触发变化率限幅</span>
            </div>
          )}

          {/* 执行结果 */}
          {result && (
            <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${result.safetyTriggered ? "bg-orange-50 border border-orange-200 text-orange-700" : "bg-green-50 border border-green-200 text-green-700"}`}>
              {result.safetyTriggered
                ? <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                : <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />}
              <span>
                {result.safetyTriggered
                  ? `保底防线触发，实际下发 ${result.applied} ${unit}。${result.safetyNote ?? ""}`
                  : `指令已下发，目标 ${result.applied} ${unit}（等待网关回执）`}
              </span>
            </div>
          )}

          <Button
            className="w-full"
            disabled={inputValue === currentValue || loading}
            onClick={() => setConfirming(true)}
          >
            <Send className="h-3.5 w-3.5 mr-2" />
            下发指令
          </Button>
        </CardContent>
      </Card>

      {/* 二次确认弹窗 */}
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              确认下发控制指令
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <p className="text-slate-600">
              即将向 <span className="font-semibold">{label}</span> 下发指令：
            </p>
            <div className="rounded-lg bg-slate-50 p-3 font-mono text-center">
              <span className="text-slate-500">{currentValue}</span>
              <span className="mx-3 text-slate-400">→</span>
              <span className="text-blue-600 font-bold">{inputValue} {unit}</span>
            </div>
            {isBeyondSafety && (
              <p className="text-xs text-orange-600 flex items-center gap-1">
                <Shield className="h-3 w-3" />
                保底防线将自动截断至安全范围
              </p>
            )}
            <p className="text-xs text-slate-400">
              指令日志会实时记录。MVP阶段暂不发送至边缘网关 MQTT，仅记录到数据库。
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? "下发中..." : "确认下发"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
