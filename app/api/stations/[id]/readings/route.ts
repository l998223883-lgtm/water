export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/stations/[id]/readings?sensor=DO&range=24h&agg=5m
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(req.url);
  const VALID_SENSOR_TYPES = ["PH", "DO", "ORP", "FLOW_IN", "DOSING_PHOSPHORUS", "DOSING_CARBON", "DOSING_DISINFECTANT", "DOSING_PAM"];
  const sensorType = searchParams.get("sensor") ?? "DO";
  if (!VALID_SENSOR_TYPES.includes(sensorType)) {
    return NextResponse.json({ error: "invalid sensor type" }, { status: 400 });
  }
  const range = searchParams.get("range") ?? "24h";
  const agg = searchParams.get("agg") ?? "5m"; // 聚合粒度

  // 解析时间范围
  const rangeMap: Record<string, number> = {
    "1h": 1,
    "6h": 6,
    "24h": 24,
    "48h": 48,
    "7d": 24 * 7,
  };
  const hours = rangeMap[range] ?? 24;
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const sensor = await prisma.sensor.findUnique({
    where: { stationId_type: { stationId: params.id, type: sensorType as never } },
  });

  if (!sensor) {
    return NextResponse.json({ error: "Sensor not found" }, { status: 404 });
  }

  // 解析聚合粒度（分钟）
  const aggMap: Record<string, number> = { "1m": 1, "5m": 5, "15m": 15, "1h": 60 };
  const aggMinutes = aggMap[agg] ?? 5;

  // 标准 PostgreSQL date_trunc 聚合
  // PLACEHOLDER: TimescaleDB time_bucket() 性能更好，数据量大后替换
  // PLACEHOLDER: TimescaleDB time_bucket() 在数据量大后替换以提升性能
  const rows = await prisma.$queryRaw<{ ts: Date; avg_value: number; min_value: number; max_value: number }[]>`
    SELECT
      date_trunc('minute', timestamp) -
        (EXTRACT(MINUTE FROM timestamp)::int % ${aggMinutes} * interval '1 minute') AS ts,
      ROUND(AVG(value)::numeric, 2) AS avg_value,
      ROUND(MIN(value)::numeric, 2) AS min_value,
      ROUND(MAX(value)::numeric, 2) AS max_value
    FROM sensor_readings
    WHERE "sensorId" = ${sensor.id}
      AND timestamp >= ${since}
    GROUP BY 1
    ORDER BY 1 ASC
  `;

  return NextResponse.json({
    sensorId: sensor.id,
    sensorType,
    unit: sensor.unit,
    minNormal: sensor.minNormal,
    maxNormal: sensor.maxNormal,
    range,
    agg,
    data: rows.map((r) => ({
      ts: r.ts.toISOString(),
      value: Number(r.avg_value),
      min: Number(r.min_value),
      max: Number(r.max_value),
    })),
  });
}
