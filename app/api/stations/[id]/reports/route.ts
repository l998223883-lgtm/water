export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateReportSummary } from "@/lib/placeholders";

// GET /api/stations/[id]/reports?month=2024-03
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month") ?? new Date().toISOString().slice(0, 7);

  const existing = await prisma.report.findUnique({
    where: { stationId_month: { stationId: params.id, month } },
  });
  if (existing) return NextResponse.json(existing);

  return NextResponse.json(null);
}

// POST /api/stations/[id]/reports  → 生成/重新生成月报
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  let month: string;
  try {
    ({ month } = await req.json());
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month must be in YYYY-MM format" }, { status: 400 });
  }

  const [year, mon] = month.split("-").map(Number);
  if (mon < 1 || mon > 12) {
    return NextResponse.json({ error: "invalid month value" }, { status: 400 });
  }
  const start = new Date(year, mon - 1, 1);
  const end = new Date(year, mon, 0, 23, 59, 59);

  // 聚合该月数据：单次 JOIN+GROUP BY 替代 N+1
  const sensors = await prisma.sensor.findMany({
    where: { stationId: params.id, isActive: true },
    select: { id: true, type: true },
  });

  const avgValues: Record<string, number> = {};
  if (sensors.length > 0) {
    const rows = await prisma.$queryRaw<{ sensor_id: string; avg: number }[]>`
      SELECT "sensorId" AS sensor_id, ROUND(AVG(value)::numeric, 2) AS avg
      FROM sensor_readings
      WHERE "sensorId" = ANY(${sensors.map((s) => s.id)})
        AND timestamp >= ${start}
        AND timestamp <= ${end}
      GROUP BY "sensorId"
    `;
    const byId = new Map(rows.map((r) => [r.sensor_id, Number(r.avg)]));
    for (const s of sensors) {
      avgValues[s.type] = byId.get(s.id) ?? 0;
    }
  }

  const alertCount = await prisma.alert.count({
    where: { stationId: params.id, triggeredAt: { gte: start, lte: end } },
  });
  const criticalAlerts = await prisma.alert.count({
    where: {
      stationId: params.id,
      severity: "CRITICAL",
      triggeredAt: { gte: start, lte: end },
    },
  });
  const labSamples = await prisma.labSample.findMany({
    where: { stationId: params.id, sampledAt: { gte: start, lte: end } },
  });
  const codOutSamples = labSamples.filter((l) => l.codOut !== null);
  const avgCodOut = codOutSamples.length
    ? codOutSamples.reduce((s, l) => s + l.codOut!, 0) / codOutSamples.length
    : null;
  const codCompliance = avgCodOut !== null ? (avgCodOut <= 50 ? 100 : 0) : 95; // PLACEHOLDER

  const metrics = {
    avgDo: avgValues["DO"] ?? 0,
    avgPh: avgValues["PH"] ?? 0,
    avgFlowIn: avgValues["FLOW_IN"] ?? 0,
    alertCount,
    criticalAlerts,
    uptime: 98.5,        // PLACEHOLDER: 真实值从心跳日志计算
    codCompliance,
    avgCodOut,
    labSampleCount: labSamples.length,
    energyKwh: null,     // PLACEHOLDER: 接电表数据后填入
    pacKg: null,         // PLACEHOLDER: 接药耗数据后填入
  };

  // PLACEHOLDER: P1阶段把 generateReportSummary 替换为 Claude Haiku API 调用
  const summary = generateReportSummary({
    avgDo: metrics.avgDo,
    avgPh: metrics.avgPh,
    alertCount,
    criticalAlerts,
    uptime: metrics.uptime,
    codCompliance,
    month,
  });

  const report = await prisma.report.upsert({
    where: { stationId_month: { stationId: params.id, month } },
    create: { stationId: params.id, month, summary, metrics },
    update: { summary, metrics },
  });

  return NextResponse.json(report);
}
