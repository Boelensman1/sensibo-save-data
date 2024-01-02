import Koa from 'koa'
import Router from '@koa/router'
import send from 'koa-send'

import createKnex from 'knex'
import knexConfig from './knexfile.mjs'

const knex = createKnex(knexConfig.development)

const app = new Koa()
const router = new Router()

router.get('/', (ctx) => {
  return send(ctx, './index.html')
})

router.get('/data.json', async (ctx) => {
  const temperaturesWithhumidities = await knex('temperatures')
    .select(
      'temperatures.time',
      'temperatures.value as temperature',
      'humidities.value as humidity',
      'name as deviceName',
      knex.raw('devices.sensorForId is not null as isSensor'),
    )
    .join('humidities', function () {
      this.on('temperatures.time', '=', 'humidities.time').andOn(
        'temperatures.deviceId',
        '=',
        'humidities.deviceId',
      )
    })
    .join('devices', 'devices.id', '=', 'temperatures.deviceId')
    .whereNotNull('devices.sensorForId') // temporary
    .orderBy('temperatures.time')

  ctx.body = {
    cols: [
      { label: 'Time', type: 'string' },
      { label: 'Temperature (°C)', type: 'number' },
      { label: 'Humidity (%)', type: 'number' },
    ],
    rows: temperaturesWithhumidities.map((data) => ({
      c: [
        { v: new Date(data.time).toISOString() },
        { v: data.isSensor ? data.temperature : null },
        { v: data.isSensor ? data.humidity : null },
      ],
    })),
  }
})

app.use(router.routes()).use(router.allowedMethods())

app.listen(process.env.PORT ?? 3000)
