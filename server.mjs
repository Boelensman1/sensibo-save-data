import Koa from 'koa'
import Router from '@koa/router'
import send from 'koa-send'

import createKnex from 'knex'
import knexConfig from './knexfile.mjs'

const knex = createKnex(knexConfig.development)

const app = new Koa()
const router = new Router()

// add error handler
app.use(async (_ctx, next) => {
  try {
    await next()
  } catch (err) {
    err.status = err.statusCode || err.status || 500
    throw err
  }
})

const toGoogleChartDate = (date) =>
  `Date(${date.getFullYear()}, ${date.getMonth()}, ${date.getDate()}, ${date.getHours()}, ${date.getMinutes()}, ${date.getSeconds()}, ${date.getMilliseconds()})`

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

  // Validate granularity based on period
  const periodDuration = period[1].getTime() - period[0].getTime()
  const hours = periodDuration / (60 * 60 * 1000)
  const days = hours / 24
  const granularity = ctx.request.query.granularity || 'hour'

  if (granularity === 'second' && hours > 12) {
    const err = new Error(
      'Second granularity is only allowed for periods up to 12 hours',
    )
    err.statusCode = 400
    throw err
  }
  if (granularity === 'minute' && days > 7) {
    const err = new Error(
      'Minute granularity is only allowed for periods up to 7 days',
    )
    err.statusCode = 400
    throw err
  }
  if (granularity === 'hour' && days > 64) {
    const err = new Error(
      'Hour granularity is only allowed for periods up to 64 days',
    )
    err.statusCode = 400
    throw err
  }

  const temperaturesWithhumidities = await knex
    .with(
      'truncated_time_data',
      knex.raw(
        `SELECT
        time,
        immutable_date_trunc(?, time) AS truncated_time
    FROM temperatures`,
        [granularity],
      ),
    )
    .fromRaw(`"truncated_time_data", "temperatures"`)
    .distinctOn('truncated_time_data.truncated_time')
    .select(
      'temperatures.time',
      'temperatures.value as temperature',
      'humidities.value as humidity',
      'name as deviceName',
      knex.raw('devices."sensorForId" is not null as "isSensor"'),
    )
    .join('humidities', function () {
      this.on('temperatures.time', '=', 'humidities.time').andOn(
        'temperatures.deviceId',
        '=',
        'humidities.deviceId',
      )
    })
    .join('devices', 'devices.id', '=', 'temperatures.deviceId')
    .whereRaw('"temperatures"."time" = "truncated_time_data"."time"')
    .whereBetween('temperatures.time', period)
    .whereBetween('humidities.time', period)
    .orderBy('truncated_time_data.truncated_time', 'DESC')

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

const port = process.env.PORT ?? 3000
app.listen(port)
console.log('Slimme meter server started, listening on port', port)
