-- CreateEnum
CREATE TYPE "StationStatus" AS ENUM ('ONLINE', 'OFFLINE', 'MAINTENANCE', 'ALARM');

-- CreateEnum
CREATE TYPE "SensorType" AS ENUM ('PH', 'DO', 'ORP', 'FLOW_IN', 'LEVEL_IN', 'LEVEL_OUT', 'TURBIDITY', 'CONDUCTIVITY', 'TEMP');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('SENSOR_FAULT', 'THRESHOLD_HIGH', 'THRESHOLD_LOW', 'STORM_EVENT', 'SYSTEM_ANOMALY', 'CONTROL_OVERRIDE');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ControlDevice" AS ENUM ('BLOWER', 'DOSING_PUMP');

-- CreateEnum
CREATE TYPE "ControlSource" AS ENUM ('ALGORITHM', 'MANUAL', 'SAFETY');

-- CreateTable
CREATE TABLE "stations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "processType" TEXT NOT NULL,
    "status" "StationStatus" NOT NULL DEFAULT 'ONLINE',
    "gatewayId" TEXT,
    "lastHeartbeat" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sensors" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "type" "SensorType" NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "minNormal" DOUBLE PRECISION NOT NULL,
    "maxNormal" DOUBLE PRECISION NOT NULL,
    "minPhysical" DOUBLE PRECISION NOT NULL,
    "maxPhysical" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "healthScore" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "lastValue" DOUBLE PRECISION,
    "lastReadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sensors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sensor_readings" (
    "id" BIGSERIAL NOT NULL,
    "sensorId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "quality" INTEGER NOT NULL DEFAULT 100,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sensor_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "sensorId" TEXT,
    "type" "AlertType" NOT NULL,
    "severity" "Severity" NOT NULL DEFAULT 'WARNING',
    "message" TEXT NOT NULL,
    "diagnosis" TEXT,
    "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_orders" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "alertId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "aiSuggestion" TEXT,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_samples" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "sampledAt" TIMESTAMP(3) NOT NULL,
    "codOut" DOUBLE PRECISION,
    "nh3nOut" DOUBLE PRECISION,
    "tpOut" DOUBLE PRECISION,
    "ssOut" DOUBLE PRECISION,
    "codIn" DOUBLE PRECISION,
    "nh3nIn" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_samples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "control_logs" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "device" "ControlDevice" NOT NULL,
    "parameter" TEXT NOT NULL,
    "oldValue" DOUBLE PRECISION NOT NULL,
    "newValue" DOUBLE PRECISION NOT NULL,
    "clampedFrom" DOUBLE PRECISION,
    "source" "ControlSource" NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "control_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "summary" TEXT,
    "metrics" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "soft_models" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "mae" DOUBLE PRECISION,
    "bias" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "modelPath" TEXT,
    "trainedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "soft_models_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sensors_stationId_type_key" ON "sensors"("stationId", "type");

-- CreateIndex
CREATE INDEX "sensor_readings_sensorId_timestamp_idx" ON "sensor_readings"("sensorId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "alerts_stationId_status_idx" ON "alerts"("stationId", "status");

-- CreateIndex
CREATE INDEX "alerts_stationId_triggeredAt_idx" ON "alerts"("stationId", "triggeredAt" DESC);

-- CreateIndex
CREATE INDEX "control_logs_stationId_issuedAt_idx" ON "control_logs"("stationId", "issuedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "reports_stationId_month_key" ON "reports"("stationId", "month");

-- AddForeignKey
ALTER TABLE "sensors" ADD CONSTRAINT "sensors_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensor_readings" ADD CONSTRAINT "sensor_readings_sensorId_fkey" FOREIGN KEY ("sensorId") REFERENCES "sensors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_sensorId_fkey" FOREIGN KEY ("sensorId") REFERENCES "sensors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "alerts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_samples" ADD CONSTRAINT "lab_samples_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_logs" ADD CONSTRAINT "control_logs_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soft_models" ADD CONSTRAINT "soft_models_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
