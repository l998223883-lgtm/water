import { cn } from "@/lib/utils";

interface SensorValueCardProps {
  type: string; name: string; value: number | null; unit: string;
  minNormal: number; maxNormal: number; healthScore: number; lastReadAt: string | null;
}

const sensorIcons: Record<string, string> = {
  PH: "⚗️", DO: "💧", ORP: "⚡", FLOW_IN: "🌊",
  LEVEL_IN: "📏", LEVEL_OUT: "📏", TURBIDITY: "🔍", TEMP: "🌡️",
};

function getStatus(value: number | null, min: number, max: number, health: number) {
  if (health < 0.5 || value === null) return "fault";
  if (value < min * 0.7 || value > max * 1.3) return "critical";
  if (value < min || value > max) return "warning";
  return "normal";
}

const statusStyles = {
  normal:   { card: "border-slate-200/60", dot: "bg-green-400",              label: "正常", labelColor: "text-green-600", bar: "bg-green-400" },
  warning:  { card: "border-amber-200",    dot: "bg-amber-400 animate-pulse", label: "偏差", labelColor: "text-amber-600", bar: "bg-amber-400" },
  critical: { card: "border-red-200",      dot: "bg-red-500 animate-pulse",   label: "异常", labelColor: "text-red-500",   bar: "bg-red-400"  },
  fault:    { card: "border-slate-200/60", dot: "bg-slate-300",               label: "故障", labelColor: "text-slate-400", bar: "bg-slate-300" },
};

export function SensorValueCard({ type, name, value, unit, minNormal, maxNormal, healthScore, lastReadAt }: SensorValueCardProps) {
  const status = getStatus(value, minNormal, maxNormal, healthScore);
  const styles = statusStyles[status];
  const icon = sensorIcons[type] ?? "📡";
  const readAt = lastReadAt
    ? new Date(lastReadAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "—";
  const barPct = value !== null
    ? Math.min(100, Math.max(0, ((value - minNormal * 0.5) / (maxNormal * 1.5 - minNormal * 0.5)) * 100))
    : 0;

  return (
    <div className={cn("rounded-xl border bg-white p-4 transition-all", styles.card)}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-lg">{icon}</span>
        <div className="flex items-center gap-1">
          <span className={cn("h-1.5 w-1.5 rounded-full", styles.dot)} />
          <span className={cn("text-[10px] font-medium", styles.labelColor)}>{styles.label}</span>
        </div>
      </div>
      <p className="text-xs text-slate-400 mb-0.5">{name}</p>
      <p className="text-2xl font-bold text-slate-800 leading-none tabular-nums">
        {value !== null ? value.toFixed(2) : "—"}
        <span className="text-xs font-normal text-slate-400 ml-1">{unit}</span>
      </p>
      <div className="mt-3 h-1 rounded-full bg-slate-100">
        <div className={cn("h-1 rounded-full transition-all", styles.bar)} style={{ width: `${barPct}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
        <span>{minNormal}–{maxNormal}</span>
        <span>{readAt}</span>
      </div>
    </div>
  );
}
