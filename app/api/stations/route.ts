export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const stations = await prisma.station.findMany({
    include: {
      sensors: {
        where: { isActive: true },
        select: {
          id: true,
          type: true,
          name: true,
          unit: true,
          lastValue: true,
          lastReadAt: true,
          healthScore: true,
          minNormal: true,
          maxNormal: true,
        },
      },
      _count: {
        select: {
          alerts: { where: { status: "OPEN" } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(stations);
}
