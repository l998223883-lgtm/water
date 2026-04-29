/**
 * 所有 PLACEHOLDER 逻辑集中在这里。
 * 每个函数顶部标注：当前实现方式 → 真实接入方式。
 *
 * MVP阶段：函数返回基于规则的估算值或模板字符串。
 * 真实数据接入后：替换函数体，接口签名保持不变。
 */

// ─── 类型定义 ──────────────────────────────────────────────────────────────────

export interface SensorSnapshot {
  ph: number;
  do: number;    // 溶解氧 mg/L
  orp: number;   // mV
  flowIn: number; // m³/h
  temp?: number;
}

export interface SoftMeasureResult {
  codOut: number;   // 预测出水COD mg/L
  nh3nOut: number;  // 预测出水氨氮 mg/L
  confidence: number; // 0-1
  source: "model" | "fallback"; // fallback=使用经验均值
}

export interface ControlRecommendation {
  blowerHz: number;        // 鼓风机建议频率
  dosingRatePct: number;   // 加药泵建议开度%
  reason: string;
  safetyTriggered: boolean;
}

export interface AlertDiagnosis {
  diagnosis: string;
  suggestion: string;
  source: "rule" | "ai"; // rule=模板，ai=Haiku API
}

// ─── 软测量（COD/氨氮预测）────────────────────────────────────────────────────
// 当前：经验公式（文献经验值，仅供展示）
// 真实：LightGBM ONNX 模型推理 → lib/models/onnx-runner.ts
// 接入时机：积累30天化验数据后，P1阶段

export function predictSoftMeasure(
  sensors: SensorSnapshot,
  bias: { cod: number; nh3n: number } = { cod: 0, nh3n: 0 }
): SoftMeasureResult {
  // PLACEHOLDER: 基于文献经验的粗估公式
  // DO高→好氧充分→COD去除率高；ORP低→反硝化好→氨氮低
  const doFactor = Math.max(0.5, Math.min(1.2, sensors.do / 2.0));
  const codOut = Math.max(15, 45 / doFactor + bias.cod);
  const nh3nOut = Math.max(0.5, 4 / (1 + sensors.do * 0.3) + bias.nh3n);

  return {
    codOut: parseFloat(codOut.toFixed(1)),
    nh3nOut: parseFloat(nh3nOut.toFixed(2)),
    confidence: 0.55, // 经验公式置信度低，上线后 LightGBM 可达0.85+
    source: "fallback",
  };
}

// ─── 模糊控制推荐（曝气+加药）────────────────────────────────────────────────
// 当前：简化规则表
// 真实：模糊控制状态机 → lib/control/fuzzy-controller.ts
// 接入时机：边缘网关 MQTT 联通后，P2阶段

export function getControlRecommendation(
  sensors: SensorSnapshot,
  designCapacity: number // 设计处理量 m³/day
): ControlRecommendation {
  const designFlowHourly = designCapacity / 24;
  const flowRatio = sensors.flowIn / designFlowHourly;

  let blowerHz = 35;
  let reason = "正常工况，维持标准频率";
  let safetyTriggered = false;

  // PLACEHOLDER: 简化规则表（真实版用模糊隶属函数）
  if (flowRatio < 0.3 && sensors.do > 2.0) {
    blowerHz = 25;
    reason = "低负荷夜间，DO充足，降频节电";
  } else if (sensors.do < 1.0) {
    blowerHz = 45;
    reason = "DO偏低，提频补氧";
  } else if (flowRatio > 1.2) {
    blowerHz = 48;
    reason = "进水流量超设计值120%，高负荷模式";
  }

  // 保底防线：频率必须在 [20, 50] Hz
  if (blowerHz < 20 || blowerHz > 50) {
    const original = blowerHz;
    blowerHz = Math.max(20, Math.min(50, blowerHz));
    safetyTriggered = true;
    reason = `安全限幅：原始建议${original}Hz，已截断至${blowerHz}Hz`;
  }

  // PLACEHOLDER: 加药前馈（真实版用 K_pac × 流量 × 浊度 × 温度系数）
  const baseDosePct = Math.min(80, Math.max(20, flowRatio * 50));

  return {
    blowerHz,
    dosingRatePct: parseFloat(baseDosePct.toFixed(1)),
    reason,
    safetyTriggered,
  };
}

// ─── 传感器健康分计算 ─────────────────────────────────────────────────────────
// 当前：基于最近值的简单规则
// 真实：滑动窗口统计（std/跳变率/与软测量偏差）→ 边缘网关本地计算后上报

export function calcHealthScore(
  values: number[], // 最近N个读数
  minPhysical: number,
  maxPhysical: number
): number {
  if (values.length < 3) return 0.5;

  const recent = values.slice(-60); // 最近60个点

  // 检查是否卡死（标准差极小）
  const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
  const std = Math.sqrt(
    recent.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / recent.length
  );
  if (std < 0.001 * Math.abs(mean) && mean !== 0) return 0.2;

  // 检查频繁突跳
  let jumpCount = 0;
  const maxDelta = (maxPhysical - minPhysical) * 0.1;
  for (let i = 1; i < recent.length; i++) {
    if (Math.abs(recent[i] - recent[i - 1]) > maxDelta) jumpCount++;
  }
  if (jumpCount > 10) return 0.4;

  return 1.0;
}

// ─── 告警诊断说明 ─────────────────────────────────────────────────────────────
// 当前：规则模板（覆盖80%常见场景）
// 真实：复杂/未知模式时调 Claude Haiku → lib/ai/haiku-diagnose.ts
// 接入时机：P1，且仅在规则模板返回 confidence<0.7 时触发

export function generateAlertDiagnosis(params: {
  alertType: string;
  sensorType?: string;
  value?: number;
  threshold?: number;
  sensors?: SensorSnapshot;
}): AlertDiagnosis {
  const { alertType, sensorType, value, threshold, sensors } = params;

  // PLACEHOLDER: 规则模板库
  const templates: Record<string, AlertDiagnosis> = {
    SENSOR_FAULT: {
      diagnosis: `${sensorType || "传感器"}读数异常（${value?.toFixed(2) ?? "—"}），可能原因：传感器结垢/断线/信号卡死。`,
      suggestion: "建议：1) 现场检查探头是否干净 2) 检查信号线接头 3) 对比人工测量值确认是否漂移",
      source: "rule",
    },
    THRESHOLD_LOW: {
      diagnosis: `${sensorType || "指标"}当前值 ${value?.toFixed(2) ?? "—"}，低于下限 ${threshold?.toFixed(2) ?? "—"}。${
        sensorType === "DO" ? "溶解氧不足可能导致好氧微生物活性下降，出水COD升高风险。" : ""
      }`,
      suggestion: sensorType === "DO"
        ? "建议：检查鼓风机运行状态，确认曝气管是否堵塞，临时提升曝气频率至45Hz"
        : "建议：现场检查对应设备运行状态",
      source: "rule",
    },
    THRESHOLD_HIGH: {
      diagnosis: `${sensorType || "指标"}当前值 ${value?.toFixed(2) ?? "—"}，超过上限 ${threshold?.toFixed(2) ?? "—"}。`,
      suggestion: "建议：检查进水水质是否异常，必要时降低进水量",
      source: "rule",
    },
    STORM_EVENT: {
      diagnosis: `检测到进水流量突增（当前约为设计流量的 ${
        sensors ? ((sensors.flowIn / 10) * 100).toFixed(0) : "—"
      }%），疑似暴雨冲击事件。进水COD/SS通常同步升高。`,
      suggestion: "建议：1) 鼓风机调至最高频 2) 加大PAC投加量20-30% 3) 密切关注出水浊度，必要时超越排放",
      source: "rule",
    },
    CONTROL_OVERRIDE: {
      diagnosis: "保底防线触发：控制算法输出超出安全范围，系统已自动截断至安全值。",
      suggestion: "建议：检查传感器数据是否可信，排查后手动确认算法恢复",
      source: "rule",
    },
  };

  return templates[alertType] ?? {
    diagnosis: `告警类型：${alertType}。系统无对应规则模板。`,
    suggestion: "建议：人工现场排查。",
    source: "rule",
  };
}

// ─── 月报摘要 ─────────────────────────────────────────────────────────────────
// 当前：模板字符串填空
// 真实：调 Claude Haiku，每月1次，成本可忽略

export function generateReportSummary(metrics: {
  avgDo: number;
  avgPh: number;
  alertCount: number;
  criticalAlerts: number;
  uptime: number; // %
  codCompliance: number; // 达标率%
  month: string;
}): string {
  // PLACEHOLDER: 模板字符串，P1替换为 Haiku API 调用
  const compliance = metrics.codCompliance >= 95 ? "达标情况良好" : "存在超标风险，需关注";
  return `${metrics.month} 运行总结：本月系统在线率 ${metrics.uptime.toFixed(1)}%，${compliance}（出水COD达标率 ${metrics.codCompliance.toFixed(0)}%）。共发生告警 ${metrics.alertCount} 次，其中严重告警 ${metrics.criticalAlerts} 次。曝气池平均DO ${metrics.avgDo.toFixed(1)} mg/L，平均pH ${metrics.avgPh.toFixed(1)}。[PLACEHOLDER: 接入 Claude Haiku 后生成详细分析]`;
}

// ─── 模拟实时数据（无 MQTT 时的 Demo 数据源）────────────────────────────────
// 仅用于 Demo/开发环境，生产环境通过 MQTT ingest 替换

export function generateMockReading(
  sensorType: string,
  lastValue?: number,
  timestamp?: Date
): number {
  const hour = (timestamp ?? new Date()).getHours();

  // PLACEHOLDER: 模拟真实站点日变化规律（基于 simulator.py 的简化版）
  const patterns: Record<string, () => number> = {
    DO: () => {
      // 曝气循环波动：白天2.0-2.5，夜间1.5-2.0
      const base = hour >= 7 && hour <= 22 ? 2.2 : 1.7;
      return parseFloat((base + (Math.random() - 0.5) * 0.4).toFixed(2));
    },
    PH: () => {
      const base = 7.2;
      return parseFloat((base + (Math.random() - 0.5) * 0.3).toFixed(2));
    },
    ORP: () => {
      const base = 80;
      return parseFloat((base + (Math.random() - 0.5) * 30).toFixed(1));
    },
    FLOW_IN: () => {
      // 早晚高峰（7-9时，17-19时）
      const isPeak = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19);
      const base = isPeak ? 18 : 10; // m³/h，500吨/天站
      return parseFloat((base + (Math.random() - 0.5) * 3).toFixed(1));
    },
    LEVEL_IN: () => parseFloat((1.5 + (Math.random() - 0.5) * 0.4).toFixed(2)),
    LEVEL_OUT: () => parseFloat((2.0 + (Math.random() - 0.5) * 0.3).toFixed(2)),
    TURBIDITY: () => parseFloat((Math.random() * 3 + 1).toFixed(1)),
    TEMP: () => parseFloat((18 + (Math.random() - 0.5) * 4).toFixed(1)),
    CONDUCTIVITY: () => parseFloat((450 + (Math.random() - 0.5) * 50).toFixed(0)),
  };

  const generator = patterns[sensorType];
  if (!generator) return lastValue ?? 0;

  // 偶发暴雨冲击（概率1%）
  if (Math.random() < 0.01 && sensorType === "FLOW_IN") {
    return parseFloat(((lastValue ?? 10) * 3).toFixed(1));
  }

  return generator();
}
