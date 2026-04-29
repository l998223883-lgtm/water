/**
 * Seed 脚本：创建单站 MVP 演示数据
 * 运行：npx ts-node prisma/seed.ts  或  npx prisma db seed
 *
 * PLACEHOLDER 标注：
 * - 传感器读数：generateMockReading() 生成，真实数据从 MQTT 入库后不再需要 seed
 * - 化验记录：手工录入替代
 * - 软测量模型：isActive=false，等真实模型训练后更新
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { generateMockReading } from "../lib/placeholders";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPrismaArg = any;

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 开始 Seed 数据...");

  // ── 清理旧数据（开发环境幂等）──────────────────────────────────────────────
  await prisma.sensorReading.deleteMany();
  await prisma.workOrder.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.controlLog.deleteMany();
  await prisma.labSample.deleteMany();
  await prisma.report.deleteMany();
  await prisma.softModel.deleteMany();
  await prisma.sensor.deleteMany();
  await prisma.station.deleteMany();

  // ── 创建种子站点 ────────────────────────────────────────────────────────────
  const station = await prisma.station.create({
    data: {
      name: "XX镇第一污水处理站",
      location: "XX省XX市XX镇工业园区路1号",
      capacity: 500,        // 500吨/天
      processType: "MBBR",
      status: "ONLINE",
      gatewayId: "GW-DEMO-001", // PLACEHOLDER: 真实网关ID从硬件SN获取
      lastHeartbeat: new Date(),
    },
  });
  console.log(`✅ 创建站点: ${station.name} (${station.id})`);

  // ── 创建传感器（P0 硬件 BOM 对应的4个核心传感器）─────────────────────────
  const sensorDefs: AnyPrismaArg[] = [
    {
      type: "PH",
      name: "进水pH",
      unit: "pH",
      location: "进水井",
      minNormal: 6.5,
      maxNormal: 8.5,
      minPhysical: 0,
      maxPhysical: 14,
    },
    {
      type: "DO",
      name: "曝气池DO",
      unit: "mg/L",
      location: "曝气池A",
      minNormal: 1.5,
      maxNormal: 4.0,
      minPhysical: 0,
      maxPhysical: 20,
    },
    {
      type: "ORP",
      name: "曝气池ORP",
      unit: "mV",
      location: "曝气池A",
      minNormal: -50,
      maxNormal: 200,
      minPhysical: -500,
      maxPhysical: 500,
    },
    {
      type: "FLOW_IN",
      name: "进水流量",
      unit: "m³/h",
      location: "进水井",
      minNormal: 5,
      maxNormal: 25,   // 500t/天 ≈ 20.8 m³/h 均值
      minPhysical: 0,
      maxPhysical: 80,
    },
  ];

  const sensors = await Promise.all(
    sensorDefs.map((def) =>
      prisma.sensor.create({
        data: { stationId: station.id, ...def },
      })
    )
  );
  console.log(`✅ 创建传感器: ${sensors.map((s) => s.name).join(", ")}`);

  // ── 生成过去48小时的模拟历史读数 ─────────────────────────────────────────
  // PLACEHOLDER: 真实数据从 MQTT ingest API 写入，seed只用于 demo
  console.log("⏳ 生成历史读数（48小时 × 4传感器，每分钟一条）...");
  const now = new Date();
  const readingsBatch: Array<{
    sensorId: string;
    value: number;
    quality: number;
    timestamp: Date;
  }> = [];

  for (const sensor of sensors) {
    let lastVal: number | undefined;
    for (let minutesAgo = 48 * 60; minutesAgo >= 0; minutesAgo -= 1) {
      const ts = new Date(now.getTime() - minutesAgo * 60 * 1000);
      const value = generateMockReading(sensor.type, lastVal, ts);
      lastVal = value;
      readingsBatch.push({
        sensorId: sensor.id,
        value,
        quality: Math.random() > 0.02 ? 100 : 60, // 2%概率低质量数据
        timestamp: ts,
      });
    }
  }

  // 分批插入，避免单次事务过大
  const BATCH = 500;
  for (let i = 0; i < readingsBatch.length; i += BATCH) {
    await prisma.sensorReading.createMany({
      data: readingsBatch.slice(i, i + BATCH),
    });
  }
  console.log(`✅ 写入 ${readingsBatch.length} 条历史读数`);

  // 更新传感器 lastValue
  for (const sensor of sensors) {
    const latest = readingsBatch
      .filter((r) => r.sensorId === sensor.id)
      .at(-1);
    if (latest) {
      await prisma.sensor.update({
        where: { id: sensor.id },
        data: { lastValue: latest.value, lastReadAt: latest.timestamp },
      });
    }
  }

  // ── 创建演示告警 ────────────────────────────────────────────────────────────
  const doSensor = sensors.find((s: AnyPrismaArg) => s.type === "DO")!;

  const alert1 = await prisma.alert.create({
    data: {
      stationId: station.id,
      sensorId: doSensor.id,
      type: "THRESHOLD_LOW",
      severity: "WARNING",
      message: "曝气池DO低于下限 1.5 mg/L，当前 1.12 mg/L",
      diagnosis:
        "溶解氧不足，好氧微生物活性可能下降。检查鼓风机运行状态及曝气管是否堵塞。[PLACEHOLDER: P1接Haiku增强诊断]",
      status: "OPEN",
      triggeredAt: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2小时前
    },
  });

  const alert2 = await prisma.alert.create({
    data: {
      stationId: station.id,
      type: "STORM_EVENT",
      severity: "CRITICAL",
      message: "进水流量突增至设计值3倍，疑似暴雨冲击事件",
      diagnosis:
        "进水流量异常升高，进水COD/SS通常同步升高。建议提升曝气频率，增加PAC投加量20-30%。[PLACEHOLDER: P1接Haiku增强诊断]",
      status: "RESOLVED",
      triggeredAt: new Date(now.getTime() - 26 * 60 * 60 * 1000),
      resolvedAt: new Date(now.getTime() - 22 * 60 * 60 * 1000),
    },
  });

  const alert3 = await prisma.alert.create({
    data: {
      stationId: station.id,
      type: "SENSOR_FAULT",
      severity: "WARNING",
      message: "ORP传感器读数卡死（连续60分钟无变化），疑似结垢",
      diagnosis: "传感器健康分跌至0.2，可能原因：探头结垢。[PLACEHOLDER: P1接Haiku增强诊断]",
      status: "ACKNOWLEDGED",
      triggeredAt: new Date(now.getTime() - 5 * 60 * 60 * 1000),
      acknowledgedAt: new Date(now.getTime() - 4 * 60 * 60 * 1000),
    },
  });

  console.log(`✅ 创建演示告警 3 条`);

  // ── 创建工单 ────────────────────────────────────────────────────────────────
  await prisma.workOrder.create({
    data: {
      stationId: station.id,
      alertId: alert1.id,
      title: "曝气池DO偏低 - 检查鼓风机",
      description: "DO持续低于1.5 mg/L超过30分钟，需现场排查曝气系统。",
      aiSuggestion:
        "1) 检查鼓风机变频器显示频率是否与控制指令一致\n2) 检查曝气管是否均匀出泡\n3) 如鼓风机正常，检查MBBR填料是否板结\n[PLACEHOLDER: P1接Haiku生成更详细建议]",
      status: "PENDING",
    },
  });

  await prisma.workOrder.create({
    data: {
      stationId: station.id,
      alertId: alert3.id,
      title: "ORP传感器维护 - 清洗探头",
      description: "ORP探头疑似结垢，需现场清洗或校准。",
      aiSuggestion:
        "1) 取出ORP探头，用蒸馏水冲洗后软布擦拭\n2) 用pH4缓冲液和pH7缓冲液校准\n3) 若校准后仍异常，考虑更换复合电极\n[PLACEHOLDER: P1接Haiku生成更详细建议]",
      status: "IN_PROGRESS",
    },
  });
  console.log(`✅ 创建工单 2 条`);

  // ── 控制日志 ────────────────────────────────────────────────────────────────
  await prisma.controlLog.createMany({
    data: [
      {
        stationId: station.id,
        device: "BLOWER",
        parameter: "frequency_hz",
        oldValue: 35,
        newValue: 45,
        source: "ALGORITHM",
        issuedAt: new Date(now.getTime() - 3 * 60 * 60 * 1000),
        confirmedAt: new Date(now.getTime() - 3 * 60 * 60 * 1000 + 2000),
      },
      {
        stationId: station.id,
        device: "BLOWER",
        parameter: "frequency_hz",
        oldValue: 45,
        newValue: 50, // 被保底防线截断（原始请求60Hz）
        clampedFrom: 60,
        source: "SAFETY",
        issuedAt: new Date(now.getTime() - 26 * 60 * 60 * 1000),
        confirmedAt: new Date(now.getTime() - 26 * 60 * 60 * 1000 + 1500),
      },
      {
        stationId: station.id,
        device: "DOSING_PUMP",
        parameter: "dose_rate_pct",
        oldValue: 50,
        newValue: 65,
        source: "MANUAL",
        issuedAt: new Date(now.getTime() - 25 * 60 * 60 * 1000),
        confirmedAt: new Date(now.getTime() - 25 * 60 * 60 * 1000 + 3000),
      },
    ],
  });
  console.log(`✅ 创建控制日志 3 条`);

  // ── 化验记录（软测量校准数据）──────────────────────────────────────────────
  await prisma.labSample.createMany({
    data: [
      {
        stationId: station.id,
        sampledAt: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
        codOut: 42,
        nh3nOut: 3.8,
        tpOut: 0.45,
        ssOut: 8,
        codIn: 280,
        nh3nIn: 28,
        notes: "本月第一次化验，出水COD接近一级A上限",
      },
      {
        stationId: station.id,
        sampledAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        codOut: 38,
        nh3nOut: 2.9,
        tpOut: 0.38,
        ssOut: 6,
        codIn: 260,
        nh3nIn: 25,
        notes: "暴雨事件后3天复测，出水恢复正常",
      },
    ],
  });
  console.log(`✅ 创建化验记录 2 条`);

  // ── 软测量模型元数据（PLACEHOLDER）──────────────────────────────────────────
  await prisma.softModel.createMany({
    data: [
      {
        stationId: station.id,
        target: "cod_out",
        version: 0,
        mae: null,
        bias: 2.1, // 上次化验后的 bias correction
        modelPath: null, // PLACEHOLDER: 真实ONNX路径
        isActive: false, // 未训练，使用 placeholders.ts 中的经验公式
      },
      {
        stationId: station.id,
        target: "nh3n_out",
        version: 0,
        mae: null,
        bias: 0.3,
        modelPath: null,
        isActive: false,
      },
    ],
  });
  console.log(`✅ 创建软测量模型占位 2 条（isActive=false，使用经验公式）`);

  // ── 月报 PLACEHOLDER ──────────────────────────────────────────────────────
  await prisma.report.create({
    data: {
      stationId: station.id,
      month: "2024-03",
      summary:
        "2024年3月运行总结：系统在线率98.2%，出水COD达标率91.7%。本月发生告警12次，其中严重告警1次（3月15日暴雨冲击事件）。[PLACEHOLDER: P1接入Haiku后自动生成]",
      metrics: {
        uptime: 98.2,
        avgDo: 2.1,
        avgPh: 7.3,
        alertCount: 12,
        criticalAlerts: 1,
        codCompliance: 91.7,
        energyKwh: 3840,
        pacKg: 180,
      },
    },
  });
  console.log(`✅ 创建演示月报 1 条`);

  console.log("\n🎉 Seed 完成！");
  console.log(`   站点ID: ${station.id}`);
  console.log(`   传感器: ${sensors.length} 个`);
  console.log(`   历史读数: ${readingsBatch.length} 条`);
  console.log("\n📌 PLACEHOLDER 清单（需真实数据替换）:");
  console.log("   • 传感器读数 → MQTT ingest API (/api/ingest/telemetry)");
  console.log("   • 告警诊断 → lib/placeholders.ts::generateAlertDiagnosis()");
  console.log("   • AI建议 → P1阶段接 Claude Haiku");
  console.log("   • 软测量模型 → P1阶段训练 LightGBM 后更新 modelPath");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
