import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateAlertDiagnosis } from "@/lib/placeholders";

// POST /api/ingest/telemetry
// 网关或 simulator.py 通过 MQTT→HTTP bridge 调用
// Body: { gatewayId, readings: [{ sensorType, value, quality, timestamp }] }
export async function POST(req: Request) {
  let body: { gatewayId: string; readings: Array<{ sensorType: string; value: number; quality?: number; timestamp?: string }> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

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

  for (const reading of body.readings) {
    const sensor = station.sensors.find((s) => s.type === reading.sensorType);
    if (!sensor) continue;

    const ts = reading.timestamp ? new Date(reading.timestamp) : new Date();
    const quality = reading.quality ?? 100;

    // 写入时序数据
    await prisma.sensorReading.create({
      data: {
        sensorId: sensor.id,
        value: reading.value,
        quality,
        timestamp: ts,
      },
    });

    // 更新传感器最新值
    await prisma.sensor.update({
      where: { id: sensor.id },
      data: { lastValue: reading.value, lastReadAt: ts },
    });

    insertedIds.push(sensor.id);

    // ── 告警规则引擎（本地，不调API）──────────────────────────────────────────
    const isOutOfNormal =
      reading.value < sensor.minNormal || reading.value > sensor.maxNormal;
    const isPhysicalFault =
      reading.value < sensor.minPhysical || reading.value > sensor.maxPhysical;

    if (isPhysicalFault || isOutOfNormal) {
      // 去重：同类型告警已有OPEN则不重复创建
      const existing = await prisma.alert.findFirst({
        where: {
          stationId: station.id,
          sensorId: sensor.id,
          status: "OPEN",
          type: isPhysicalFault ? "SENSOR_FAULT" : reading.value < sensor.minNormal ? "THRESHOLD_LOW" : "THRESHOLD_HIGH",
        },
      });

      if (!existing) {
        const alertType = isPhysicalFault
          ? "SENSOR_FAULT"
          : reading.value < sensor.minNormal
          ? "THRESHOLD_LOW"
          : "THRESHOLD_HIGH";

        const threshold = reading.value < sensor.minNormal ? sensor.minNormal : sensor.maxNormal;
        const diagnosis = generateAlertDiagnosis({
          alertType,
          sensorType: sensor.type,
          value: reading.value,
          threshold,
        });

        const alert = await prisma.alert.create({
          data: {
            stationId: station.id,
            sensorId: sensor.id,
            type: alertType as never,
            severity: isPhysicalFault ? "CRITICAL" : "WARNING",
            message: `${sensor.name} ${isPhysicalFault ? "物理量程异常" : reading.value < sensor.minNormal ? "低于下限" : "超过上限"}: ${reading.value.toFixed(2)} ${sensor.unit}`,
            diagnosis: diagnosis.diagnosis,
          },
        });

        // 自动创建工单
        await prisma.workOrder.create({
          data: {
            stationId: station.id,
            alertId: alert.id,
            title: `${sensor.name} 告警处理`,
            description: diagnosis.diagnosis,
            aiSuggestion: diagnosis.suggestion,
          },
        });

        newAlerts.push(alert.id);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    inserted: insertedIds.length,
    newAlerts: newAlerts.length,
  });
}
