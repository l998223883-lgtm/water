export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const VALID_STATUSES = ["OPEN", "ACKNOWLEDGED", "RESOLVED"];
  if (status && !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  const limitRaw = parseInt(searchParams.get("limit") ?? "20");
  const limit = isNaN(limitRaw) || limitRaw < 1 ? 20 : Math.min(limitRaw, 200);

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
  let alertId: string, action: "acknowledge" | "resolve";
  try {
    ({ alertId, action } = await req.json());
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!alertId || !["acknowledge", "resolve"].includes(action)) {
    return NextResponse.json({ error: "alertId and valid action required" }, { status: 400 });
  }

  const data =
    action === "resolve"
      ? { status: "RESOLVED" as const, resolvedAt: new Date() }
      : { status: "ACKNOWLEDGED" as const, acknowledgedAt: new Date() };

  const existing = await prisma.alert.findUnique({ where: { id: alertId } });
  if (!existing) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }

  const alert = await prisma.alert.update({
    where: { id: alertId },
    data,
  });

  return NextResponse.json(alert);
}
