export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  let body: { stationId: string; sampledAt: string; codOut?: number; nh3nOut?: number; tpOut?: number; ssOut?: number; codIn?: number; notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { stationId, sampledAt, codOut, nh3nOut, tpOut, ssOut, codIn, notes } = body;
  if (!stationId || !sampledAt) {
    return NextResponse.json({ error: "stationId and sampledAt are required" }, { status: 400 });
  }

  const sampledAtDate = new Date(sampledAt);
  if (isNaN(sampledAtDate.getTime())) {
    return NextResponse.json({ error: "invalid sampledAt date" }, { status: 400 });
  }

  const sample = await prisma.labSample.create({
    data: {
      stationId,
      sampledAt: sampledAtDate,
      codOut: codOut ?? null,
      nh3nOut: nh3nOut ?? null,
      tpOut: tpOut ?? null,
      ssOut: ssOut ?? null,
      codIn: codIn ?? null,
      notes: notes ?? null,
    },
  });

  return NextResponse.json({
    ...sample,
    sampledAt: sample.sampledAt.toISOString(),
    createdAt: sample.createdAt.toISOString(),
  });
}
