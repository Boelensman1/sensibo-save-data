import 'dotenv/config'
import createKnex from 'knex'
import knexConfig from './knexfile.mjs'

import SensiboApi from './lib/sensibo-api.mjs'

const sensiboApi = new SensiboApi({
  apiKey: process.env.API_KEY,
})

const knex = createKnex(knexConfig.development)

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

const pushHistoricalMeasurements = async (device) => {
  // get remoteId
  const parentDevice = await knex('devices')
    .where({ id: device.sensorForId })
    .first()

  if (!parentDevice) {
    throw new Error(`Parent device (${device.sensorForId}) not found`)
  }

  const measurements = await sensiboApi.getHistoricalMeasurements(
    parentDevice.sensiboId,
  )
  await Promise.all([
    knex('temperatures')
      .insert(
        measurements.temperature.map((data) => ({
          ...data,
          deviceId: device.id,
        })),
      )
      .onConflict(['time', 'deviceId'])
      .ignore(),
    knex('humidities')
      .insert(
        measurements.humidity.map((data) => ({
          ...data,
          deviceId: device.id,
        })),
      )
      .onConflict(['time', 'deviceId'])
      .ignore(),
  ])
}

const pushDeviceMeasurements = async (device) => {
  const deviceInfo = await sensiboApi.getDeviceInfo(device.sensiboId)
  await Promise.all([
    knex('temperatures')
      .insert({
        time: new Date(deviceInfo.measurements.time.time),
        value: deviceInfo.measurements.temperature,
        deviceId: device.id,
      })
      .onConflict(['time', 'deviceId'])
      .ignore(),
    ,
    knex('humidities')
      .insert({
        time: new Date(deviceInfo.measurements.time.time),
        value: deviceInfo.measurements.humidity,
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
        return pushHistoricalMeasurements(device)
      } else {
        return pushDeviceMeasurements(device)
      }
    }),
  )
}

main().then(() => knex.destroy())
