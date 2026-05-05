import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "./prisma";
import { log } from "./logger";

let client: GoogleGenerativeAI | null = null;
function getClient(): GoogleGenerativeAI | null {
  if (!process.env.GOOGLE_API_KEY) return null;
  if (!client) client = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
  return client;
}

const MODEL = "gemini-1.5-flash";

interface AlertContext {
  stationName: string;
  processType: string;
  sensorName?: string | null;
  sensorType?: string | null;
  unit?: string | null;
  value?: number;
  minNormal?: number;
  maxNormal?: number;
  alertType: string;
  severity: string;
  baseDiagnosis: string;
}

const SYSTEM_PROMPT = `你是污水处理厂的运行专家。基于传感器告警上下文，给出简洁、可执行的诊断和处置建议。

要求：
- 用中文回复，全长不超过 200 字
- 输出 JSON 格式：{"diagnosis": "...", "suggestion": "..."}
- diagnosis：1-2 句话说明可能成因（结合工艺：MBBR/AAO/AO/SBR）
- suggestion：3 条以内具体操作步骤，每条以「①②③」开头
- 不要客套话，不要重复输入信息`;

export async function enhanceAlertWithHaiku(alertId: string): Promise<void> {
  const c = getClient();
  if (!c) return;

  const alert = await prisma.alert.findUnique({
    where: { id: alertId },
    include: {
      station: { select: { name: true, processType: true } },
      sensor: { select: { name: true, type: true, unit: true, minNormal: true, maxNormal: true, lastValue: true } },
    },
  });
  if (!alert) return;

  const ctx: AlertContext = {
    stationName: alert.station.name,
    processType: alert.station.processType,
    sensorName: alert.sensor?.name,
    sensorType: alert.sensor?.type,
    unit: alert.sensor?.unit,
    value: alert.sensor?.lastValue ?? undefined,
    minNormal: alert.sensor?.minNormal,
    maxNormal: alert.sensor?.maxNormal,
    alertType: alert.type,
    severity: alert.severity,
    baseDiagnosis: alert.diagnosis ?? "",
  };

  const userPrompt = `站点：${ctx.stationName}（${ctx.processType} 工艺）
告警类型：${ctx.alertType}（${ctx.severity}）
${ctx.sensorName ? `传感器：${ctx.sensorName}（${ctx.sensorType}）当前值 ${ctx.value?.toFixed(2) ?? "—"} ${ctx.unit}，正常范围 ${ctx.minNormal}~${ctx.maxNormal}` : ""}
规则诊断：${ctx.baseDiagnosis}

输出 JSON。`;

  try {
    const model = c.getGenerativeModel({ model: MODEL, systemInstruction: SYSTEM_PROMPT });
    const resp = await model.generateContent(userPrompt);
    const text = resp.response.text();

    // 解析 JSON：模型偶尔会包 ```json
    const jsonStr = text.match(/\{[\s\S]*\}/)?.[0];
    if (!jsonStr) {
      log.warn("haiku.parse_failed", { alertId, text: text.slice(0, 200) });
      return;
    }
    const parsed = JSON.parse(jsonStr) as { diagnosis?: string; suggestion?: string };

    const newDiagnosis = parsed.diagnosis && parsed.suggestion
      ? `${parsed.diagnosis}\n建议：${parsed.suggestion}`
      : null;
    if (!newDiagnosis) return;

    await prisma.alert.update({
      where: { id: alertId },
      data: { diagnosis: newDiagnosis },
    });

    // 同步更新关联工单的 AI 建议
    await prisma.workOrder.updateMany({
      where: { alertId },
      data: { aiSuggestion: parsed.suggestion },
    });

    log.info("haiku.alert_enhanced", { alertId, model: MODEL });
  } catch (err) {
    log.error("haiku.enhance_failed", {
      alertId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
