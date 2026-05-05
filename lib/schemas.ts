import { z } from "zod";

export const TelemetrySchema = z.object({
  gatewayId: z.string().min(1).max(64),
  readings: z
    .array(
      z.object({
        sensorType: z.string().min(1).max(32),
        value: z.number().finite(),
        quality: z.number().int().min(0).max(100).optional(),
        timestamp: z.string().datetime().optional(),
      })
    )
    .min(1)
    .max(200),
});

export const ControlSchema = z.object({
  device: z.enum(["BLOWER", "DOSING_PUMP"]),
  value: z.number().finite(),
  source: z.enum(["MANUAL", "ALGORITHM"]).optional(),
});

export const LabSchema = z.object({
  stationId: z.string().min(1),
  sampledAt: z.string().refine((s) => !isNaN(new Date(s).getTime()), "invalid date"),
  codOut: z.number().finite().nonnegative().nullable().optional(),
  nh3nOut: z.number().finite().nonnegative().nullable().optional(),
  tpOut: z.number().finite().nonnegative().nullable().optional(),
  ssOut: z.number().finite().nonnegative().nullable().optional(),
  codIn: z.number().finite().nonnegative().nullable().optional(),
  nh3nIn: z.number().finite().nonnegative().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export const AlertPatchSchema = z.object({
  alertId: z.string().min(1),
  action: z.enum(["acknowledge", "resolve"]),
});

export const DemoSchema = z.object({
  action: z.enum(["reset", "storm", "fault", "normal"]),
});

export function formatZodError(err: z.ZodError): string {
  return err.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
}
