import Koa from 'koa'
import Router from '@koa/router'
import send from 'koa-send'

import createKnex from 'knex'
import knexConfig from './knexfile.mjs'

const knex = createKnex(knexConfig.development)

const app = new Koa()
const router = new Router()

const toGoogleChartDate = (date) =>
  `Date(${date.getFullYear()}, ${date.getMonth()}, ${date.getDay()}, ${date.getHours()}, ${date.getMinutes()}, ${date.getSeconds()}, ${date.getMilliseconds()})`

router.get('/', (ctx) => {
  return send(ctx, './index.html')
})

router.get('/data.json', async (ctx) => {
  // get period
  const now = new Date()
  const oneDayBefore = new Date()
  oneDayBefore.setDate(now.getDate() - 1)
  let period = [oneDayBefore, now] // default period
  if (ctx.request.query.period) {
    period = JSON.parse(ctx.request.query.period).map((d) => new Date(d))
  }

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
    .orderBy('temperatures.time')
    .where('temperatures.time', '>=', period[0].getTime())
    .andWhere('temperatures.time', '<=', period[1].getTime())
    .where('humidities.time', '>=', period[0].getTime())
    .andWhere('humidities.time', '<=', period[1].getTime())

  ctx.body = {
    cols: [
      { label: 'Time', type: 'date' },
      { label: 'Temperature (Sensor)', type: 'number' },
      { label: 'Humidity (Sensor)', type: 'number' },
      { label: 'Temperature (Device)', type: 'number' },
      { label: 'Humidity (Device)', type: 'number' },
    ],
    rows: temperaturesWithhumidities.map((data) => ({
      c: [
        { v: toGoogleChartDate(new Date(data.time)) },
        { v: data.isSensor ? data.temperature : null },
        { v: data.isSensor ? data.humidity : null },
        { v: !data.isSensor ? data.temperature : null },
        { v: !data.isSensor ? data.humidity : null },
      ],
    })),
  }
})

app.use(router.routes()).use(router.allowedMethods())

app.listen(process.env.PORT ?? 3000)
