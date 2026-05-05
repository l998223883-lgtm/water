import { prisma } from "@/lib/prisma";
import { AlertList } from "@/components/stations/AlertList";
import { Badge } from "@/components/ui/badge";
import { Bell, CheckCircle2, AlertTriangle, AlertCircle } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

interface SearchParams {
  station?: string;
  status?: "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "ALL";
  severity?: "INFO" | "WARNING" | "CRITICAL" | "ALL";
  page?: string;
}

async function getData(sp: SearchParams) {
  const stations = await prisma.station.findMany({
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  if (stations.length === 0) {
    return {
      stations: [],
      station: null,
      alerts: [],
      total: 0,
      page: 1,
      counts: { open: 0, ack: 0, resolved: 0, critical: 0 },
    };
  }

  const station = stations.find((s) => s.id === sp.station) ?? stations[0];

  const status = sp.status && sp.status !== "ALL" ? sp.status : undefined;
  const severity = sp.severity && sp.severity !== "ALL" ? sp.severity : undefined;
  const page = Math.max(1, parseInt(sp.page ?? "1") || 1);

  const where = {
    stationId: station.id,
    ...(status ? { status } : {}),
    ...(severity ? { severity } : {}),
  } as const;

  const [alerts, total, counts] = await Promise.all([
    prisma.alert.findMany({
      where,
      include: {
        sensor: { select: { type: true, name: true, unit: true } },
        workOrders: { select: { id: true, status: true, title: true } },
      },
      orderBy: { triggeredAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.alert.count({ where }),
    prisma.alert.groupBy({
      by: ["status", "severity"],
      where: { stationId: station.id },
      _count: true,
    }),
  ]);

  let openCount = 0,
    ackCount = 0,
    resolvedCount = 0,
    criticalCount = 0;
  for (const c of counts) {
    if (c.status === "OPEN") openCount += c._count;
    if (c.status === "ACKNOWLEDGED") ackCount += c._count;
    if (c.status === "RESOLVED") resolvedCount += c._count;
    if (c.status === "OPEN" && c.severity === "CRITICAL") criticalCount += c._count;
  }

  return {
    stations,
    station,
    alerts,
    total,
    page,
    counts: { open: openCount, ack: ackCount, resolved: resolvedCount, critical: criticalCount },
  };
}

function buildQuery(sp: SearchParams, override: Partial<SearchParams>) {
  const merged = { ...sp, ...override };
  const params = new URLSearchParams();
  if (merged.station) params.set("station", merged.station);
  if (merged.status) params.set("status", merged.status);
  if (merged.severity) params.set("severity", merged.severity);
  if (merged.page && merged.page !== "1") params.set("page", merged.page);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { stations, station, alerts, total, counts, page } = await getData(searchParams);

  if (!station) {
    return <div className="p-6 text-center text-slate-400 dark:text-slate-500">暂无站点数据</div>;
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const status = searchParams.status ?? "ALL";
  const severity = searchParams.severity ?? "ALL";

  const serialized = alerts.map((a) => ({
    ...a,
    triggeredAt: a.triggeredAt.toISOString(),
  }));

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">告警中心</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{station.name}</p>
        </div>
        <Badge variant="outline" className="text-slate-400 dark:text-slate-500 border-dashed text-xs">
          📱 推送配置（即将上线）
        </Badge>
      </div>

      {stations.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {stations.map((s) => (
            <Link
              key={s.id}
              href={`/alerts${buildQuery(searchParams, { station: s.id, page: "1" })}`}
              className={`rounded-full px-3 py-1 text-xs border ${
                s.id === station.id
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:bg-slate-900/40"
              }`}
            >
              {s.name}
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "待处理", count: counts.open, icon: Bell, color: "text-red-500 bg-red-50" },
          { label: "严重告警", count: counts.critical, icon: AlertCircle, color: "text-red-600 bg-red-50" },
          { label: "已确认", count: counts.ack, icon: AlertTriangle, color: "text-yellow-500 bg-yellow-50" },
          { label: "已解决", count: counts.resolved, icon: CheckCircle2, color: "text-green-500 bg-green-50" },
        ].map(({ label, count, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border bg-white dark:bg-slate-900 px-4 py-3 flex items-center gap-3">
            <div className={`rounded-lg p-2 ${color.split(" ")[1]}`}>
              <Icon className={`h-4 w-4 ${color.split(" ")[0]}`} />
            </div>
            <div>
              <p className="text-xl font-bold">{count}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-slate-400 dark:text-slate-500">状态:</span>
          {(["ALL", "OPEN", "ACKNOWLEDGED", "RESOLVED"] as const).map((s) => (
            <Link
              key={s}
              href={`/alerts${buildQuery(searchParams, { status: s, page: "1" })}`}
              className={`rounded px-2 py-0.5 border ${
                status === s
                  ? "bg-slate-800 text-white border-slate-800"
                  : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:bg-slate-900/40"
              }`}
            >
              {s === "ALL" ? "全部" : s === "OPEN" ? "待处理" : s === "ACKNOWLEDGED" ? "已确认" : "已解决"}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-slate-400 dark:text-slate-500">级别:</span>
          {(["ALL", "INFO", "WARNING", "CRITICAL"] as const).map((s) => (
            <Link
              key={s}
              href={`/alerts${buildQuery(searchParams, { severity: s, page: "1" })}`}
              className={`rounded px-2 py-0.5 border ${
                severity === s
                  ? "bg-slate-800 text-white border-slate-800"
                  : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:bg-slate-900/40"
              }`}
            >
              {s === "ALL" ? "全部" : s}
            </Link>
          ))}
        </div>
      </div>

      {serialized.length > 0 ? (
        <AlertList stationId={station.id} initialAlerts={serialized} />
      ) : (
        <div className="rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 py-12 text-center text-slate-400 dark:text-slate-500">
          <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-400" />
          <p>无符合条件的告警</p>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>
            共 {total} 条 · 第 {page}/{totalPages} 页
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/alerts${buildQuery(searchParams, { page: String(page - 1) })}`}
                className="rounded border px-3 py-1 hover:bg-slate-50 dark:bg-slate-900/40"
              >
                上一页
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/alerts${buildQuery(searchParams, { page: String(page + 1) })}`}
                className="rounded border px-3 py-1 hover:bg-slate-50 dark:bg-slate-900/40"
              >
                下一页
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
