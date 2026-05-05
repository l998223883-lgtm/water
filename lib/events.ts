import { EventEmitter } from "events";

/**
 * 进程内事件总线（用于 SSE 实时推送）。
 * 注意：仅在单实例部署下可靠；多实例环境需替换为 Redis pub/sub 或 Postgres LISTEN/NOTIFY。
 */
const globalForBus = globalThis as unknown as { __wwBus?: EventEmitter };
export const bus: EventEmitter = globalForBus.__wwBus ?? new EventEmitter();
bus.setMaxListeners(100);
if (!globalForBus.__wwBus) globalForBus.__wwBus = bus;

export interface AlertEvent {
  type: "alert.created";
  alertId: string;
  stationId: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  message: string;
  triggeredAt: string;
}

export interface AlertUpdatedEvent {
  type: "alert.updated";
  alertId: string;
  stationId: string;
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
}

export type WwEvent = AlertEvent | AlertUpdatedEvent;

export function emitAlert(e: AlertEvent | AlertUpdatedEvent) {
  bus.emit("ww", e);
}
