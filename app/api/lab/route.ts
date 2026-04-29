import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const { stationId, sampledAt, codOut, nh3nOut, tpOut, ssOut, codIn, notes } =
    await req.json();

  const sample = await prisma.labSample.create({
    data: {
      stationId,
      sampledAt: new Date(sampledAt),
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
