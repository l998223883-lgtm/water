import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const { action } = await req.json() as { action: string };
  const station = await prisma.station.findFirst({ orderBy: { createdAt: "asc" }, include: { sensors: true } });
  if (!station) return NextResponse.json({ error: "no station" }, { status: 404 });

  if (action === "reset") {
    // 关闭所有告警，重置传感器为正常值
    await prisma.alert.updateMany({ where: { stationId: station.id, status: "OPEN" }, data: { status: "RESOLVED", resolvedAt: new Date() } });
    const defaults: Record<string, number> = { PH: 7.2, DO: 2.8, ORP: 120, FLOW_IN: 15 };
    for (const sensor of station.sensors) {
      const val = defaults[sensor.type];
      if (val != null) {
        await prisma.sensor.update({ where: { id: sensor.id }, data: { lastValue: val, healthScore: 1.0, lastReadAt: new Date() } });
        await prisma.sensorReading.create({ data: { sensorId: sensor.id, value: val, quality: 100, timestamp: new Date() } });
      }
    }
    await prisma.station.update({ where: { id: station.id }, data: { status: "ONLINE", lastHeartbeat: new Date() } });
    return NextResponse.json({ ok: true, message: "演示数据已重置为正常状态" });
  }

  if (action === "storm") {
    // 模拟暴雨事件：流量飙升，DO 下降
    const flowSensor = station.sensors.find(s => s.type === "FLOW_IN");
    const doSensor = station.sensors.find(s => s.type === "DO");
    if (flowSensor) {
      await prisma.sensor.update({ where: { id: flowSensor.id }, data: { lastValue: 42.5, lastReadAt: new Date() } });
      await prisma.sensorReading.create({ data: { sensorId: flowSensor.id, value: 42.5, quality: 95, timestamp: new Date() } });
    }
    if (doSensor) {
      await prisma.sensor.update({ where: { id: doSensor.id }, data: { lastValue: 0.6, lastReadAt: new Date() } });
      await prisma.sensorReading.create({ data: { sensorId: doSensor.id, value: 0.6, quality: 90, timestamp: new Date() } });
    }
    await prisma.alert.create({
      data: {
        stationId: station.id,
        sensorId: doSensor?.id,
        type: "STORM_EVENT",
        severity: "WARNING",
        message: "暴雨冲击：进水流量超限 42.5 m³/h，DO 骤降至 0.6 mg/L",
        diagnosis: "暴雨导致进水量激增至设计值的 283%，建议：① 立即开启备用曝气风机至最大频率 50Hz；② 减少回流比至 50%；③ 持续监测 DO，目标恢复至 1.5 mg/L 以上。",
        status: "OPEN",
        triggeredAt: new Date(),
        value: 42.5,
        threshold: 25,
      }
    });
    return NextResponse.json({ ok: true, message: "已触发暴雨冲击事件" });
  }

  if (action === "fault") {
    // 模拟传感器故障
    const phSensor = station.sensors.find(s => s.type === "PH");
    if (phSensor) {
      await prisma.sensor.update({ where: { id: phSensor.id }, data: { lastValue: 14.0, healthScore: 0.2, lastReadAt: new Date() } });
      await prisma.sensorReading.create({ data: { sensorId: phSensor.id, value: 14.0, quality: 15, timestamp: new Date() } });
      await prisma.alert.create({
        data: {
          stationId: station.id,
          sensorId: phSensor.id,
          type: "SENSOR_FAULT",
          severity: "CRITICAL",
          message: "pH 传感器疑似故障：读数 14.0（超出物理量程）",
          diagnosis: "pH 读数超出理论上限，传感器可能断线或探头污染严重。建议：① 检查探头与变送器接线；② 取水样人工比对；③ 清洗或更换探头。",
          status: "OPEN",
          triggeredAt: new Date(),
          value: 14.0,
          threshold: 9.0,
        }
      });
    }
    return NextResponse.json({ ok: true, message: "已触发 pH 传感器故障事件" });
  }

  if (action === "normal") {
    // 推送一组完全正常的数据
    const values: Record<string, number> = { PH: 7.15, DO: 2.65, ORP: 115, FLOW_IN: 16.2 };
    for (const sensor of station.sensors) {
      const val = values[sensor.type];
      if (val != null) {
        await prisma.sensor.update({ where: { id: sensor.id }, data: { lastValue: val, healthScore: 1.0, lastReadAt: new Date() } });
        await prisma.sensorReading.create({ data: { sensorId: sensor.id, value: val, quality: 100, timestamp: new Date() } });
      }
    }
    await prisma.station.update({ where: { id: station.id }, data: { lastHeartbeat: new Date() } });
    return NextResponse.json({ ok: true, message: "已推送一组正常传感器数据" });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
