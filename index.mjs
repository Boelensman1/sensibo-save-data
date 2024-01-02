import 'dotenv/config'
import createKnex from 'knex'
import knexConfig from './knexfile.mjs'

import SensiboApi from './lib/sensibo-api.mjs'

const sensiboApi = new SensiboApi({
  apiKey: process.env.API_KEY,
})

const knex = createKnex(knexConfig.development)

function* chunks(arr, n) {
  for (let i = 0; i < arr.length; i += n) {
    yield arr.slice(i, i + n)
  }
}

const syncDevices = async () => {
  const [devicesRemote, devicesLocal] = await Promise.all([
    sensiboApi.getDevices(),
    knex('devices'),
  ])
  await Promise.all(
    devicesRemote.map(async (device) => {
      // check if already in db
      if (!devicesLocal.find(({ sensiboId }) => sensiboId === device.id)) {
        const deviceInfo = await sensiboApi.getDeviceInfo(device.id)

        const [newDevice] = await knex('devices')
          .insert({
            name: deviceInfo.room.name,
            sensiboId: `${device.id}`,
          })
          .returning('*')

        const [newSensor] = await knex('devices')
          .insert({
            name: `${deviceInfo.room.name}-sensor`,
            sensorForId: newDevice.id,
          })
          .returning('*')

        devicesLocal.push(newSensor)
        devicesLocal.push(newDevice)
      }
    }),
  )
  return devicesLocal
}

const getSensiboId = async (device) => {
  if (device.sensiboId) {
    return device.sensiboId
  }

  const parentDevice = await knex('devices')
    .where({ id: device.sensorForId })
    .first()

  if (!parentDevice) {
    throw new Error(`Parent device (${device.sensorForId}) not found`)
  }

  return parentDevice.sensiboId
}

const pushHistoricalMeasurements = async (device) => {
  const sensiboId = await getSensiboId(device)
  const measurements = await sensiboApi.getHistoricalMeasurements(sensiboId)

  // we need to chunk the inserts at 500 per time, sqlite doesn't like if we
  // do more (too many terms in compound SELECT)
  await Promise.all([
    ...[...chunks(measurements.temperature, 500)].map((temperatures) =>
      knex('temperatures')
        .insert(
          temperatures.map((data) => ({
            ...data,
            deviceId: device.id,
          })),
        )
        .onConflict(['time', 'deviceId'])
        .ignore(),
    ),
    ...[...chunks(measurements.humidity, 500)].map((humidities) =>
      knex('humidities')
        .insert(
          humidities.map((data) => ({
            ...data,
            deviceId: device.id,
          })),
        )
        .onConflict(['time', 'deviceId'])
        .ignore(),
    ),
  ])
}

const pushDeviceMeasurements = async (device) => {
  const sensiboId = await getSensiboId(device)
  const deviceInfo = await sensiboApi.getDeviceInfo(sensiboId)

  const measurements = !!device.sensorForId
    ? deviceInfo.mainMeasurementsSensor.measurements
    : deviceInfo.measurements

  await Promise.all([
    knex('temperatures')
      .insert({
        time: new Date(measurements.time.time),
        value: measurements.temperature,
        deviceId: device.id,
      })
      .onConflict(['time', 'deviceId'])
      .ignore(),
    ,
    knex('humidities')
      .insert({
        time: new Date(measurements.time.time),
        value: measurements.humidity,
        deviceId: device.id,
      })
      .onConflict(['time', 'deviceId'])
      .ignore(),
    ,
  ])
}

const main = async () => {
  const devices = await syncDevices()
  await Promise.all(
    devices.map(async (device) => {
      if (device.sensorForId) {
        // this is a sensor
        await pushHistoricalMeasurements(device)
      }
      await pushDeviceMeasurements(device)
    }),
  )
}

main().then(() => knex.destroy())
