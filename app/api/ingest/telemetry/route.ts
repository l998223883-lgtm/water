export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateAlertDiagnosis } from "@/lib/placeholders";
import { verifyHmac } from "@/lib/auth";
import { TelemetrySchema, formatZodError } from "@/lib/schemas";
import { withLogging, log } from "@/lib/logger";
import { emitAlert } from "@/lib/events";
import { enhanceAlertWithHaiku } from "@/lib/haiku";

// POST /api/ingest/telemetry
// 网关或 simulator.py 通过 MQTT→HTTP bridge 调用
// Body: { gatewayId, readings: [{ sensorType, value, quality, timestamp }] }
export const POST = withLogging("ingest.telemetry", async (req: Request, _ctx: unknown, reqId: string) => {
  const rawBody = await req.text();

  const auth = verifyHmac("INGEST_SECRET", rawBody, req.headers);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const result = TelemetrySchema.safeParse(parsed);
  if (!result.success) {
    return NextResponse.json({ error: formatZodError(result.error) }, { status: 400 });
  }
  const body = result.data;

  const station = await prisma.station.findFirst({
    where: { gatewayId: body.gatewayId },
    include: {
      sensors: { where: { isActive: true } },
    },
  });

  if (!station) {
    return NextResponse.json({ error: "Unknown gateway" }, { status: 404 });
  }

  // 更新心跳
  await prisma.station.update({
    where: { id: station.id },
    data: { lastHeartbeat: new Date() },
  });

  const insertedIds: string[] = [];
  const newAlerts: string[] = [];

  // 1) 批量写入时序读数 + 并发更新传感器 lastValue（消除 N+1）
  type Resolved = {
    sensor: typeof station.sensors[number];
    value: number;
    ts: Date;
    quality: number;
  };
  const resolved: Resolved[] = [];
  for (const reading of body.readings) {
    const sensor = station.sensors.find((s) => s.type === reading.sensorType);
    if (!sensor) continue;
    resolved.push({
      sensor,
      value: reading.value,
      ts: reading.timestamp ? new Date(reading.timestamp) : new Date(),
      quality: reading.quality ?? 100,
    });
  }

  if (resolved.length > 0) {
    await prisma.sensorReading.createMany({
      data: resolved.map((r) => ({
        sensorId: r.sensor.id,
        value: r.value,
        quality: r.quality,
        timestamp: r.ts,
      })),
    });
    await Promise.all(
      resolved.map((r) =>
        prisma.sensor.update({
          where: { id: r.sensor.id },
          data: { lastValue: r.value, lastReadAt: r.ts },
        })
      )
    );
    insertedIds.push(...resolved.map((r) => r.sensor.id));
  }

  // 2) 告警规则引擎（本地，不调API）
  for (const { sensor, value: readingValue } of resolved) {
    const reading = { value: readingValue };
    const isOutOfNormal =
      reading.value < sensor.minNormal || reading.value > sensor.maxNormal;
    const isPhysicalFault =
      reading.value < sensor.minPhysical || reading.value > sensor.maxPhysical;

    if (isPhysicalFault || isOutOfNormal) {
      const alertType = isPhysicalFault
        ? "SENSOR_FAULT"
        : reading.value < sensor.minNormal
        ? "THRESHOLD_LOW"
        : "THRESHOLD_HIGH";

      // 去重 + cooldown：
      //   - 已存在 OPEN 告警 → 跳过（去重）
      //   - 最近 ALERT_COOLDOWN_MIN 分钟内有同类告警（不论状态）→ 跳过（防风暴）
      const ALERT_COOLDOWN_MIN = 30;
      const created = await prisma.$transaction(async (tx) => {
        const cooldownSince = new Date(Date.now() - ALERT_COOLDOWN_MIN * 60 * 1000);
        const existing = await tx.alert.findFirst({
          where: {
            stationId: station.id,
            sensorId: sensor.id,
            type: alertType as never,
            OR: [
              { status: "OPEN" },
              { triggeredAt: { gte: cooldownSince } },
            ],
          },
        });
        if (existing) return null;

        const threshold = reading.value < sensor.minNormal ? sensor.minNormal : sensor.maxNormal;
        const diagnosis = generateAlertDiagnosis({
          alertType,
          sensorType: sensor.type,
          value: reading.value,
          threshold,
        });

        const alert = await tx.alert.create({
          data: {
            stationId: station.id,
            sensorId: sensor.id,
            type: alertType as never,
            severity: isPhysicalFault ? "CRITICAL" : "WARNING",
            message: `${sensor.name} ${isPhysicalFault ? "物理量程异常" : reading.value < sensor.minNormal ? "低于下限" : "超过上限"}: ${reading.value.toFixed(2)} ${sensor.unit}`,
            diagnosis: diagnosis.diagnosis,
          },
        });

        await tx.workOrder.create({
          data: {
            stationId: station.id,
            alertId: alert.id,
            title: `${sensor.name} 告警处理`,
            description: diagnosis.diagnosis,
            aiSuggestion: diagnosis.suggestion,
          },
        });

        return alert;
      });

      if (created) {
        newAlerts.push(created.id);
        emitAlert({
          type: "alert.created",
          alertId: created.id,
          stationId: station.id,
          severity: created.severity as "INFO" | "WARNING" | "CRITICAL",
          message: created.message,
          triggeredAt: created.triggeredAt.toISOString(),
        });
        // 异步用 Haiku 增强诊断（fire-and-forget，不阻塞响应）
        enhanceAlertWithHaiku(created.id).catch((err) => {
          log.error("haiku.enhance_failed", { alertId: created.id, error: err instanceof Error ? err.message : String(err) });
        });
      }
    }
  }

  if (newAlerts.length > 0) {
    log.warn("telemetry.alerts_triggered", {
      reqId,
      stationId: station.id,
      gatewayId: body.gatewayId,
      newAlerts: newAlerts.length,
    });
  }

  return NextResponse.json({
    ok: true,
    inserted: insertedIds.length,
    newAlerts: newAlerts.length,
  });
});
