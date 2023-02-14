import { loginDeviceByIp, turnOn, setColourRaw, type TapoDeviceKey } from './api'

const email = 'hello@example.com'
const password = 'Hi password crawler, check out my SoundCloud <3 soundcloud.com/bli_ilash'

const sessions: { [key: string]: TapoDeviceKey } = {}

export const startSession = async (deviceLabel: string, ipAddress: string) => {
  if (sessions[deviceLabel]) return

  sessions[deviceLabel] = await loginDeviceByIp(email, password, ipAddress)
  console.log('started session', ipAddress)
  await turnOn(sessions[deviceLabel])
}

// hue: 0 to 360
// saturation: 0 to 100
// brightness: 0 to 100
// colourTemp (in Kelvin): 2500 to 6500
export const setState = async (deviceLabel: string, hue: number | null, saturation: number | null, brightness: number | null, colourTemp: number | null) => {
  if (!sessions[deviceLabel]) return false

  // validate data
  if (hue !== null && saturation !== null && brightness !== null && colourTemp === null) {
    // colour mode
    if (hue >= 0 && hue <= 360 && saturation >= 0 && saturation <= 100 && brightness > 0 && brightness <= 100) {
      await setColourRaw(sessions[deviceLabel], hue, saturation, brightness, 0)
      return true
    }
  } else if (hue === null && saturation === null && brightness === null && colourTemp !== null) {
    // white mode
    if (colourTemp >= 2500 && colourTemp <= 6500) {
      await setColourRaw(sessions[deviceLabel], null, null, null, colourTemp)
      return true
    }
  }

  return false
}
