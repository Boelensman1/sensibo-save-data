/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async (knex) => {
  await knex.schema.createTable('devices', (table) => {
    table.increments('id')
    table.string('name').unique().notNullable()
    table.string('sensiboId').unique()
    table.smallint('sensorForId').unsigned()
    table.timestamps(true, true, true)

    table.foreign('sensorForId').references('id').inTable('devices')
  })
  await knex.schema.createTable('temperatures', (table) => {
    table.timestamp('time').notNullable()
    table.decimal('value').notNullable()
    table.smallint('deviceId').unsigned().notNullable()
    table.foreign('deviceId').references('id').inTable('devices')

    table.unique(['time', 'deviceId'])
  })
  await knex.schema.createTable('humidities', (table) => {
    table.timestamp('time').notNullable()
    table.decimal('value').notNullable()
    table.smallint('deviceId').unsigned().notNullable()
    table.foreign('deviceId').references('id').inTable('devices')

    table.unique(['time', 'deviceId'])
  })

  // add indexes
  await knex.schema.raw(`
      CREATE OR REPLACE FUNCTION immutable_date_trunc(interval_type text, ts timestamp with time zone)
      RETURNS timestamp with time zone
      AS $$
      BEGIN
          RETURN CASE
              WHEN interval_type = 'minute' THEN
                  date_trunc('minute', ts)
              WHEN interval_type = 'hour' THEN
                  date_trunc('hour', ts)
              WHEN interval_type = 'day' THEN
                  date_trunc('day', ts)
              WHEN interval_type = 'week' THEN
                  date_trunc('week', ts)
              WHEN interval_type = 'month' THEN
                  date_trunc('month', ts)
              WHEN interval_type = 'year' THEN
                  date_trunc('year', ts)
              ELSE
                  NULL
          END;
      END;
      $$
      LANGUAGE plpgsql IMMUTABLE;
    `)

  await knex.schema.raw(`
        CREATE INDEX idx_temperatures_minute_time
        ON temperatures (immutable_date_trunc('minute', "time"), "time" DESC);`)
  await knex.schema.raw(`
        CREATE INDEX idx_temperatures_hour_time
        ON temperatures (immutable_date_trunc('hour', "time"), "time" DESC);`)
  await knex.schema.raw(`
        CREATE INDEX idx_temperatures_day_time
        ON temperatures (immutable_date_trunc('day', "time"), "time" DESC);`)
  await knex.schema.raw(`
        CREATE INDEX idx_temperatures_week_time
        ON temperatures (immutable_date_trunc('week', "time"), "time" DESC);`)

  await knex.schema.raw(`
        CREATE INDEX idx_humidities_minute_time
        ON humidities (immutable_date_trunc('minute', "time"), "time" DESC);`)
  await knex.schema.raw(`
        CREATE INDEX idx_humidities_hour_time
        ON humidities (immutable_date_trunc('hour', "time"), "time" DESC);`)
  await knex.schema.raw(`
        CREATE INDEX idx_humidities_day_time
        ON humidities (immutable_date_trunc('day', "time"), "time" DESC);`)
  await knex.schema.raw(`
        CREATE INDEX idx_humidities_week_time
        ON humidities (immutable_date_trunc('week', "time"), "time" DESC);`)
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async (knex) => {
  await knex.schema.dropTable('temperatures')
  await knex.schema.dropTable('humidities')
  await knex.schema.dropTable('devices')

  await knex.schema.raw(`
      CREATE OR REPLACE FUNCTION immutable_date_trunc(interval_type text, ts timestamp with time zone)
      RETURNS timestamp with time zone
      AS $$
      BEGIN
          RETURN CASE
              WHEN interval_type = 'minute' THEN
                  date_trunc('minute', ts)
              WHEN interval_type = 'hour' THEN
                  date_trunc('hour', ts)
              WHEN interval_type = 'day' THEN
                  date_trunc('day', ts)
              WHEN interval_type = 'week' THEN
                  date_trunc('week', ts)
              WHEN interval_type = 'month' THEN
                  date_trunc('month', ts)
              WHEN interval_type = 'year' THEN
                  date_trunc('year', ts)
              ELSE
                  NULL
          END;
      END;
      $$
      LANGUAGE plpgsql IMMUTABLE;
    `)
}
