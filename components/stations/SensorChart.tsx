"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useState, useEffect, useCallback } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface ReadingPoint {
  ts: string;
  value: number;
}

interface SensorChartProps {
  stationId: string;
  sensorType: string;
  sensorName: string;
  unit: string;
  minNormal: number;
  maxNormal: number;
  color?: string;
}

const RANGE_OPTIONS = [
  { label: "1小时", value: "1h", agg: "1m" },
  { label: "6小时", value: "6h", agg: "5m" },
  { label: "24小时", value: "24h", agg: "5m" },
  { label: "48小时", value: "48h", agg: "15m" },
  { label: "7天", value: "7d", agg: "1h" },
];

export function SensorChart({
  stationId,
  sensorType,
  sensorName,
  unit,
  minNormal,
  maxNormal,
  color = "#3b82f6",
}: SensorChartProps) {
  const [range, setRange] = useState("24h");
  const [data, setData] = useState<ReadingPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const opt = RANGE_OPTIONS.find((r) => r.value === range)!;
    try {
      const res = await fetch(
        `/api/stations/${stationId}/readings?sensor=${sensorType}&range=${range}&agg=${opt.agg}`
      );
      if (res.ok) {
        const json = await res.json();
        setData(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [stationId, sensorType, range]);

  useEffect(() => {
    setLoading(true);
    fetchData();
    // 每60秒自动刷新
    const timer = setInterval(fetchData, 60_000);
    return () => clearInterval(timer);
  }, [fetchData]);

  if (loading) {
    return <Skeleton className="h-48 w-full rounded-xl" />;
  }

  const formatted = data.map((d) => ({
    ...d,
    label: format(new Date(d.ts), "HH:mm", { locale: zhCN }),
  }));

  return (
    <div className="rounded-xl border bg-white dark:bg-slate-900 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{sensorName}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">单位: {unit} · 正常范围: {minNormal}~{maxNormal}</p>
        </div>
        <div className="flex gap-1">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setRange(opt.value)}
              className={`rounded px-2 py-0.5 text-xs transition-colors ${
                range === opt.value
                  ? "bg-blue-600 text-white"
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:bg-slate-800"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={formatted} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-${sensorType}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.15} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            interval="preserveStartEnd"
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            }}
            formatter={(v) => [`${Number(v).toFixed(2)} ${unit}`, sensorName]}
            labelFormatter={(l) => `时间: ${l}`}
          />
          {/* 正常范围参考线 */}
          <ReferenceLine y={minNormal} stroke="#fbbf24" strokeDasharray="4 2" strokeWidth={1} />
          <ReferenceLine y={maxNormal} stroke="#fbbf24" strokeDasharray="4 2" strokeWidth={1} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#grad-${sensorType})`}
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
