-- CreateIndex
CREATE INDEX "alerts_stationId_sensorId_type_status_idx" ON "alerts"("stationId", "sensorId", "type", "status");
