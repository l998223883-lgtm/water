#!/usr/bin/env python3
"""
simulator.py — 模拟500吨/天MBBR污水站真实数据
直接用 HTTP POST 推送至 /api/ingest/telemetry

特性:
  ✓ 进水流量日变化曲线（早晚高峰 07-09、17-19时）
  ✓ DO在曝气循环中的波动（15分钟一个周期）
  ✓ pH / ORP / 液位 随机扰动
  ✓ 偶发「暴雨冲击」事件（流量×3，DO骤降，持续20-40分钟）
  ✓ 偶发「传感器故障」事件（数值卡死，持续15-30分钟）
  ✓ 数据清洗前的原始噪声（1-2%概率产生脏数据，测试清洗逻辑）

用法:
  python3 simulator.py                    # 默认10秒推一次
  python3 simulator.py --interval 5       # 5秒一次（演示用）
  python3 simulator.py --interval 60      # 60秒一次（接近真实站1分钟采样）
  python3 simulator.py --url http://localhost:3001  # 自定义API地址
"""

import math
import random
import time
import json
import argparse
import urllib.request
import urllib.error
from datetime import datetime
from typing import Optional, Dict, List

# ── 配置 ──────────────────────────────────────────────────────────────────────

GATEWAY_ID = "GW-DEMO-001"
DEFAULT_API_URL = "http://localhost:3000"
DEFAULT_INTERVAL = 10  # 秒

# 500吨/天 = 20.8 m³/h 均值
DESIGN_FLOW_HOURLY = 500 / 24  # ≈ 20.8

# 传感器物理量程（超出即视为硬件异常）
SENSOR_RANGES = {
    "PH":      (0.0,  14.0),
    "DO":      (0.0,  20.0),
    "ORP":     (-500, 500),
    "FLOW_IN": (0.0,  80.0),
}

# 正常运行区间（超出触发告警）
SENSOR_NORMAL = {
    "PH":      (6.5,  8.5),
    "DO":      (1.5,  4.0),
    "ORP":     (-50,  200),
    "FLOW_IN": (5.0,  25.0),
}


# ── 状态机 ────────────────────────────────────────────────────────────────────

class SimulatorState:
    def __init__(self):
        # 暴雨冲击事件
        self.storm_active = False
        self.storm_ticks_remaining = 0

        # 传感器故障事件（每个传感器独立）
        self.fault_active: Dict[str, bool] = {k: False for k in SENSOR_RANGES}
        self.fault_ticks_remaining: Dict[str, int] = {k: 0 for k in SENSOR_RANGES}
        self.fault_stuck_value: Dict[str, float] = {}

        # 曝气循环相位（0-1，15分钟一周期）
        self.aeration_phase = random.random()
        self.tick = 0

    def step(self, interval_sec: int):
        self.tick += 1
        # 更新曝气相位
        self.aeration_phase = (self.aeration_phase + interval_sec / 900) % 1.0

        # 暴雨冲击倒计时
        if self.storm_active:
            self.storm_ticks_remaining -= 1
            if self.storm_ticks_remaining <= 0:
                self.storm_active = False
                print("  [事件结束] 暴雨冲击消退，系统恢复正常")
        else:
            # 每小时约2%概率触发（每tick ≈ interval_sec/3600 * 0.02）
            if random.random() < 0.02 * interval_sec / 3600:
                duration_ticks = random.randint(20 * 60, 40 * 60) // interval_sec
                self.storm_active = True
                self.storm_ticks_remaining = max(1, duration_ticks)
                print(f"  ⚠️  [事件] 暴雨冲击！持续约{duration_ticks * interval_sec // 60}分钟")

        # 传感器故障倒计时
        for sensor in SENSOR_RANGES:
            if self.fault_active[sensor]:
                self.fault_ticks_remaining[sensor] -= 1
                if self.fault_ticks_remaining[sensor] <= 0:
                    self.fault_active[sensor] = False
                    print(f"  [事件结束] {sensor} 传感器故障恢复")
            else:
                # 每传感器每小时约0.3%概率故障
                if random.random() < 0.003 * interval_sec / 3600:
                    duration_ticks = random.randint(15 * 60, 30 * 60) // interval_sec
                    self.fault_active[sensor] = True
                    self.fault_ticks_remaining[sensor] = max(1, duration_ticks)
                    # 卡死值 = 当前正常值附近随机一个点
                    lo, hi = SENSOR_NORMAL[sensor]
                    self.fault_stuck_value[sensor] = round(random.uniform(lo, hi), 2)
                    print(f"  ⚠️  [事件] {sensor} 传感器卡死！持续约{duration_ticks * interval_sec // 60}分钟")


# ── 传感器读数生成 ─────────────────────────────────────────────────────────────

def get_flow_in(hour: float, state: SimulatorState) -> float:
    """进水流量：早晚高峰 + 暴雨事件"""
    # 正弦叠加模拟日变化：早7-9峰 + 晚17-19峰
    morning_peak = math.exp(-0.5 * ((hour - 8) / 1.2) ** 2)
    evening_peak = math.exp(-0.5 * ((hour - 18) / 1.2) ** 2)
    daily_factor = 0.6 + 0.8 * (morning_peak + evening_peak * 0.85)

    base_flow = DESIGN_FLOW_HOURLY * daily_factor
    noise = random.gauss(0, base_flow * 0.05)
    flow = base_flow + noise

    if state.storm_active:
        storm_factor = random.uniform(2.5, 3.5)
        flow *= storm_factor

    return round(max(0, flow), 1)


def get_do(state: SimulatorState) -> float:
    """溶解氧：曝气循环波动 + 暴雨冲击时骤降"""
    # 曝气周期：DO在曝气期升到2.5-3.5，停曝期降到1.0-1.5
    # 用正弦模拟：phase=0时曝气峰值，phase=0.5时谷值
    cycle = math.sin(state.aeration_phase * 2 * math.pi)
    base_do = 2.0 + cycle * 0.8  # 1.2 - 2.8 区间

    if state.storm_active:
        # 暴雨冲击：进水量大，耗氧增加，DO下降
        base_do *= random.uniform(0.4, 0.7)

    noise = random.gauss(0, 0.08)
    return round(max(0.1, base_do + noise), 2)


def get_ph(state: SimulatorState) -> float:
    """pH：7.0-7.6缓慢漂移，暴雨时略降"""
    base_ph = 7.2
    if state.storm_active:
        base_ph = 6.9  # 暴雨稀释，略偏酸
    noise = random.gauss(0, 0.06)
    return round(max(5.5, min(9.0, base_ph + noise)), 2)


def get_orp(state: SimulatorState) -> float:
    """ORP：与DO正相关，曝气期高，停曝期低"""
    cycle = math.sin(state.aeration_phase * 2 * math.pi)
    base_orp = 80 + cycle * 50  # 30-130 mV
    if state.storm_active:
        base_orp -= random.uniform(20, 50)
    noise = random.gauss(0, 8)
    return round(base_orp + noise, 1)


def generate_readings(state: SimulatorState, interval_sec: int) -> List[dict]:
    """生成一批传感器读数，含故障模拟和脏数据注入"""
    now = datetime.utcnow()
    hour = datetime.now().hour + datetime.now().minute / 60  # 本地时间

    raw = {
        "PH":      get_ph(state),
        "DO":      get_do(state),
        "ORP":     get_orp(state),
        "FLOW_IN": get_flow_in(hour, state),
    }

    readings = []
    for sensor_type, value in raw.items():
        quality = 100

        # 传感器故障：值卡死
        if state.fault_active[sensor_type]:
            value = state.fault_stuck_value.get(sensor_type, value)
            quality = 30  # 低置信度

        # 1%概率注入脏数据（测试清洗逻辑）
        elif random.random() < 0.01:
            lo, hi = SENSOR_RANGES[sensor_type]
            value = random.uniform(lo * 0.8, hi * 1.2)  # 超出量程
            quality = 10

        readings.append({
            "sensorType": sensor_type,
            "value": value,
            "quality": quality,
            "timestamp": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        })

    return readings


# ── HTTP 推送 ─────────────────────────────────────────────────────────────────

def push(api_url: str, readings: List[dict]) -> Optional[dict]:
    payload = json.dumps({
        "gatewayId": GATEWAY_ID,
        "readings": readings,
    }).encode("utf-8")

    req = urllib.request.Request(
        f"{api_url}/api/ingest/telemetry",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"  HTTP {e.code}: {e.read().decode()[:100]}")
        return None
    except Exception as e:
        print(f"  推送失败: {e}")
        return None


# ── 主循环 ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="污水站数据模拟器")
    parser.add_argument("--interval", type=int, default=DEFAULT_INTERVAL,
                        help=f"推送间隔秒数（默认{DEFAULT_INTERVAL}s）")
    parser.add_argument("--url", type=str, default=DEFAULT_API_URL,
                        help=f"API地址（默认{DEFAULT_API_URL}）")
    parser.add_argument("--verbose", action="store_true",
                        help="打印每条传感器值")
    args = parser.parse_args()

    state = SimulatorState()

    print("=" * 60)
    print("  污水站数据模拟器 v1.0")
    print(f"  站点网关: {GATEWAY_ID}")
    print(f"  API地址:  {args.url}")
    print(f"  推送间隔: {args.interval}s")
    print(f"  设计流量: {DESIGN_FLOW_HOURLY:.1f} m³/h (500吨/天)")
    print("=" * 60)
    print("  [Ctrl+C 停止]\n")

    tick_count = 0
    error_count = 0

    try:
        while True:
            state.step(args.interval)
            readings = generate_readings(state, args.interval)
            result = push(args.url, readings)

            tick_count += 1
            now_str = datetime.now().strftime("%H:%M:%S")

            if result:
                # 找到各传感器值便于打印
                vals = {r["sensorType"]: r["value"] for r in readings}
                status = "🌧 暴雨冲击" if state.storm_active else "🟢 正常"
                faults = [k for k, v in state.fault_active.items() if v]
                if faults:
                    status = f"⚠️  故障:{','.join(faults)}"

                print(
                    f"[{now_str}] #{tick_count:04d} {status} | "
                    f"DO={vals.get('DO','?'):5.2f}mg/L "
                    f"pH={vals.get('PH','?'):4.2f} "
                    f"ORP={vals.get('ORP','?'):6.1f}mV "
                    f"Q={vals.get('FLOW_IN','?'):5.1f}m³/h"
                    + (f" | 新告警:{result.get('newAlerts',0)}" if result.get("newAlerts") else "")
                )
            else:
                error_count += 1
                print(f"[{now_str}] #{tick_count:04d} ❌ 推送失败 (累计{error_count}次)")

            time.sleep(args.interval)

    except KeyboardInterrupt:
        print(f"\n\n模拟器已停止。共推送 {tick_count} 条，失败 {error_count} 条。")


if __name__ == "__main__":
    main()
