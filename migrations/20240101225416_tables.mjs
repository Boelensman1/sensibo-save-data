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
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async (knex) => {
  await knex.schema.dropTable('temperatures')
  await knex.schema.dropTable('humidity')
  await knex.schema.dropTable('devices')
}
