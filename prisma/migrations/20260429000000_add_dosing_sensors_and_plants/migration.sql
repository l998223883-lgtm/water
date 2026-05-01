-- Add dosing sensor types to SensorType enum
ALTER TYPE "SensorType" ADD VALUE 'DOSING_PHOSPHORUS';
ALTER TYPE "SensorType" ADD VALUE 'DOSING_CARBON';
ALTER TYPE "SensorType" ADD VALUE 'DOSING_DISINFECTANT';
ALTER TYPE "SensorType" ADD VALUE 'DOSING_PAM';

-- Add actual daily flow field to stations (2025 measured average)
ALTER TABLE "stations" ADD COLUMN "dailyFlowActual" DOUBLE PRECISION;
