import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { predictSoftMeasure, getControlRecommendation } from "@/lib/placeholders";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const station = await prisma.station.findUnique({
    where: { id: params.id },
    include: {
      sensors: {
        where: { isActive: true },
        orderBy: { type: "asc" },
      },
      alerts: {
        where: { status: "OPEN" },
        orderBy: { triggeredAt: "desc" },
        take: 5,
      },
      _count: {
        select: {
          alerts: { where: { status: "OPEN" } },
          workOrders: { where: { status: { in: ["PENDING", "IN_PROGRESS"] } } },
        },
      },
    },
  });

  if (!station) {
    return NextResponse.json({ error: "Station not found" }, { status: 404 });
  }

  // 软测量预测（本地计算，不调API）
  const sensorMap = Object.fromEntries(station.sensors.map((s) => [s.type, s.lastValue ?? 0]));
  const snapshot = {
    ph: sensorMap["PH"] ?? 7.0,
    do: sensorMap["DO"] ?? 2.0,
    orp: sensorMap["ORP"] ?? 80,
    flowIn: sensorMap["FLOW_IN"] ?? 10,
  };

  const softMeasure = predictSoftMeasure(snapshot);
  const controlRec = getControlRecommendation(snapshot, station.capacity);

  return NextResponse.json({ ...station, softMeasure, controlRec });
}
