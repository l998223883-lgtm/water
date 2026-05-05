export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { bus, type WwEvent } from "@/lib/events";

// GET /api/events/alerts?stationId=xxx
// SSE 实时告警流。客户端：
//   const es = new EventSource("/api/events/alerts?stationId=" + id);
//   es.addEventListener("ww", (e) => { const ev = JSON.parse(e.data); ... });
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const stationId = searchParams.get("stationId");

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      // 初始注释行 + retry 提示
      controller.enqueue(enc.encode(": connected\nretry: 3000\n\n"));

      const onEvent = (ev: WwEvent) => {
        if (stationId && ev.stationId !== stationId) return;
        try {
          controller.enqueue(enc.encode(`event: ww\ndata: ${JSON.stringify(ev)}\n\n`));
        } catch {
          /* stream closed */
        }
      };

      // 心跳 25s（防止反代/CDN 中断空闲连接）
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(enc.encode(": ping\n\n"));
        } catch {
          /* ignore */
        }
      }, 25000);

      bus.on("ww", onEvent);

      const abort = () => {
        clearInterval(heartbeat);
        bus.off("ww", onEvent);
        try { controller.close(); } catch { /* already closed */ }
      };
      req.signal.addEventListener("abort", abort);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
