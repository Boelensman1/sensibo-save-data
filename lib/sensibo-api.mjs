import got from 'got'

const baseApiUrl = 'https://home.sensibo.com/api/v2/'

class SensiboAPI {
  constructor(options) {
    this.client = got.extend({
      prefixUrl: baseApiUrl,
      searchParams: { apiKey: options.apiKey },
    })
  }

  async doRequest(url, options = {}) {
    const requestResult = await this.client(url, options).json()
    if (requestResult.status !== 'success') {
      console.error(requestResult)
      throw new Error('Request status != success')
    }
    return requestResult.result
  }

  async getDevices() {
    return this.doRequest('users/me/pods')
  }

  async getDeviceInfo(deviceId) {
    return this.doRequest(`pods/${deviceId}`, { searchParams: { fields: '*' } })
  }

  async getHistoricalMeasurements(deviceId) {
    const result = await this.doRequest(
      `pods/${deviceId}/historicalMeasurements`,
    )
    return {
      temperature: result.temperature.map(({ time, value }) => ({
        time: new Date(time),
        value,
      })),
      humidity: result.humidity.map(({ time, value }) => ({
        time: new Date(time),
        value,
      })),
    }
  }
}

export default SensiboAPI
