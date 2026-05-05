-- 把 sensor_readings 转为 TimescaleDB hypertable，按 timestamp 分区。
-- 如果当前 PostgreSQL 没有 timescaledb 扩展，这条迁移会安全跳过（保持普通表）。
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'timescaledb') THEN
    CREATE EXTENSION IF NOT EXISTS timescaledb;

    -- 注意：create_hypertable 需要分区列在主键里，sensor_readings 主键是 id (BigInt)
    -- 加 (id, timestamp) 复合主键以兼容 hypertable 约束。
    IF NOT EXISTS (
      SELECT 1 FROM timescaledb_information.hypertables
      WHERE hypertable_name = 'sensor_readings'
    ) THEN
      ALTER TABLE sensor_readings DROP CONSTRAINT IF EXISTS sensor_readings_pkey;
      ALTER TABLE sensor_readings ADD PRIMARY KEY (id, "timestamp");
      PERFORM create_hypertable(
        'sensor_readings',
        'timestamp',
        chunk_time_interval => INTERVAL '7 days',
        if_not_exists => TRUE,
        migrate_data => TRUE
      );
      RAISE NOTICE 'sensor_readings converted to TimescaleDB hypertable';
    ELSE
      RAISE NOTICE 'sensor_readings is already a hypertable';
    END IF;
  ELSE
    RAISE NOTICE 'TimescaleDB extension not available; sensor_readings remains a regular table';
  END IF;
END $$;
