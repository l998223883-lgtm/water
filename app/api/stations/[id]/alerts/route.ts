import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status"); // "OPEN" | "RESOLVED" | null=all
  const limit = parseInt(searchParams.get("limit") ?? "20");

  const alerts = await prisma.alert.findMany({
    where: {
      stationId: params.id,
      ...(status ? { status: status as never } : {}),
    },
    include: {
      sensor: { select: { type: true, name: true, unit: true } },
      workOrders: { select: { id: true, status: true, title: true } },
    },
    orderBy: { triggeredAt: "desc" },
    take: limit,
  });

  return NextResponse.json(alerts);
}

// 确认告警
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { alertId, action } = await req.json() as { alertId: string; action: "acknowledge" | "resolve" };

  const data =
    action === "resolve"
      ? { status: "RESOLVED" as const, resolvedAt: new Date() }
      : { status: "ACKNOWLEDGED" as const, acknowledgedAt: new Date() };

  const alert = await prisma.alert.update({
    where: { id: alertId },
    data,
  });

  return NextResponse.json(alert);
}
