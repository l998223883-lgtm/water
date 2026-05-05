export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 网关心跳健康检查：每分钟扫一次，超过 STALE_MINUTES 未上报心跳的站点
// 自动置为 OFFLINE 并产生一条告警（同站点已存在未解决告警则跳过）。
//
// 触发方式：
//   - Vercel Cron（vercel.json 中配置 schedule）
//   - 也可手动 GET 触发：curl -H "Authorization: Bearer $CRON_SECRET" .../api/cron/heartbeat-check
const STALE_MINUTES = 2;

export async function GET(req: Request) {
  // 权限：Vercel Cron 自动注入 x-vercel-cron 头；外部调用需 Bearer 密钥
  const cronHeader = req.headers.get("x-vercel-cron");
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  const isVercelCron = !!cronHeader;
  const hasValidBearer = secret && auth === `Bearer ${secret}`;

  if (!isVercelCron && !hasValidBearer) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const cutoff = new Date(Date.now() - STALE_MINUTES * 60 * 1000);

  const staleStations = await prisma.station.findMany({
    where: {
      status: { in: ["ONLINE", "ALARM"] },
      OR: [
        { lastHeartbeat: { lt: cutoff } },
        { lastHeartbeat: null },
      ],
    },
    select: { id: true, name: true, lastHeartbeat: true },
  });

  const newAlerts: string[] = [];
  for (const station of staleStations) {
    await prisma.$transaction(async (tx) => {
      await tx.station.update({
        where: { id: station.id },
        data: { status: "OFFLINE" },
      });
      const existing = await tx.alert.findFirst({
        where: {
          stationId: station.id,
          type: "SYSTEM_ANOMALY",
          status: { in: ["OPEN", "ACKNOWLEDGED"] },
          message: { contains: "心跳" },
        },
      });
      if (!existing) {
        const lastSeen = station.lastHeartbeat
          ? `最后心跳 ${station.lastHeartbeat.toISOString()}`
          : "从未连接";
        const alert = await tx.alert.create({
          data: {
            stationId: station.id,
            type: "SYSTEM_ANOMALY",
            severity: "CRITICAL",
            message: `网关心跳超时（>${STALE_MINUTES}min）：${station.name}`,
            diagnosis: `站点 ${station.name} 已超过 ${STALE_MINUTES} 分钟未上报数据。${lastSeen}。请检查：① 边缘网关电源与网络；② MQTT broker 连接；③ 现场断电或公网中断。`,
          },
        });
        newAlerts.push(alert.id);
      }
    });
  }

  return NextResponse.json({
    ok: true,
    checkedAt: new Date().toISOString(),
    staleStations: staleStations.length,
    newAlerts: newAlerts.length,
  });
}
