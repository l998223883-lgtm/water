export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LabSchema, formatZodError } from "@/lib/schemas";

export async function POST(req: Request) {
  let parsed: unknown;
  try {
    parsed = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const result = LabSchema.safeParse(parsed);
  if (!result.success) {
    return NextResponse.json({ error: formatZodError(result.error) }, { status: 400 });
  }
  const { stationId, sampledAt, codOut, nh3nOut, tpOut, ssOut, codIn, notes } = result.data;

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
