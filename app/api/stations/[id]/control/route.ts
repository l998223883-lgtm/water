export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 保底防线配置（三道防线第一道：物理阈值）
const SAFETY_LIMITS = {
  BLOWER: {
    parameter: "frequency_hz",
    min: 20,
    max: 50,
    maxDeltaPct: 0.3, // 单次变化不超过30%
    unit: "Hz",
  },
  DOSING_PUMP: {
    parameter: "dose_rate_pct",
    min: 10,
    max: 90,
    maxDeltaPct: 0.4,
    unit: "%",
  },
} as const;

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const logs = await prisma.controlLog.findMany({
    where: { stationId: params.id },
    orderBy: { issuedAt: "desc" },
    take: 20,
  });
  return NextResponse.json(logs);
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  let body: { device: "BLOWER" | "DOSING_PUMP"; value: number; source?: "MANUAL" | "ALGORITHM" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.device || !["BLOWER", "DOSING_PUMP"].includes(body.device)) {
    return NextResponse.json({ error: "invalid device" }, { status: 400 });
  }
  if (typeof body.value !== "number" || !isFinite(body.value)) {
    return NextResponse.json({ error: "value must be a finite number" }, { status: 400 });
  }

  const station = await prisma.station.findUnique({
    where: { id: params.id },
  });
  if (!station) {
    return NextResponse.json({ error: "Station not found" }, { status: 404 });
  }

  const limits = SAFETY_LIMITS[body.device];
  const source = body.source ?? "MANUAL";

  // 取上一条同设备日志，计算变化率
  const lastLog = await prisma.controlLog.findFirst({
    where: { stationId: params.id, device: body.device },
    orderBy: { issuedAt: "desc" },
  });
  const oldValue = lastLog?.newValue ?? (body.device === "BLOWER" ? 35 : 50);

  // ── 保底防线：硬限幅 ──────────────────────────────────────────────────────
  let newValue = body.value;
  let clampedFrom: number | undefined;
  let safetyNote: string | undefined;

  // 1. 绝对范围限制
  if (newValue < limits.min || newValue > limits.max) {
    clampedFrom = newValue;
    newValue = Math.max(limits.min, Math.min(limits.max, newValue));
    safetyNote = `超出安全范围[${limits.min}-${limits.max}${limits.unit}]，已截断至${newValue}${limits.unit}`;
  }

  // 2. 单次变化率限制（防止指令突变损坏设备）
  const delta = Math.abs(newValue - oldValue);
  const maxDelta = oldValue * limits.maxDeltaPct;
  if (delta > maxDelta && delta > 2) {
    clampedFrom = clampedFrom ?? body.value;
    const direction = newValue > oldValue ? 1 : -1;
    newValue = parseFloat((oldValue + direction * maxDelta).toFixed(1));
    safetyNote = (safetyNote ?? "") + ` 变化率超限（>${(limits.maxDeltaPct * 100).toFixed(0)}%/次），已截断至${newValue}${limits.unit}`;
  }

  const log = await prisma.controlLog.create({
    data: {
      stationId: params.id,
      device: body.device,
      parameter: limits.parameter,
      oldValue,
      newValue,
      clampedFrom: clampedFrom ?? null,
      source: clampedFrom ? "SAFETY" : source,
      // PLACEHOLDER: 真实环境通过 MQTT 发送指令至边缘网关，等待 confirmedAt 回执
      // confirmedAt 在收到网关 ACK 后由 /api/ingest/ack 更新
    },
  });

  return NextResponse.json({
    log,
    safetyTriggered: !!clampedFrom,
    safetyNote,
    requested: body.value,
    applied: newValue,
  });
}
