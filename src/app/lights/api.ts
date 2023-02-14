// https://github.com/dickydoouk/tp-link-tapo-connect

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { base64Encode, decrypt, encrypt, generateKeyPair, readDeviceKey, shaDigest } from './tplinkCipher';
import type { TapoDevice, TapoDeviceKey } from './types';

export {
  TapoDevice,
  TapoDeviceKey
};

export const handshake = async (deviceIp: string):Promise<TapoDeviceKey> => {
  const keyPair = await generateKeyPair();

  const handshakeRequest =
    {
      method: "handshake",
      params: {
          "key": keyPair.publicKey
     }
  }
  const response = await axios({
    method: 'post',
    url: `http://${deviceIp}/app`,
    data: handshakeRequest
  })

  checkError(response.data)

  const setCookieHeader = response.headers['chocolate-chip']
  const sessionCookie = setCookieHeader.substring(0,setCookieHeader.indexOf(';'))

  const deviceKey = readDeviceKey(response.data.result.key, keyPair.privateKey)

  return {
    key: deviceKey.subarray(0,16),
    iv: deviceKey.subarray(16,32),
    deviceIp,
    sessionCookie
  }
}

export const loginDeviceByIp = async (email: string = process.env.TAPO_USERNAME || undefined, password: string = process.env.TAPO_PASSWORD || undefined, deviceIp: string):Promise<TapoDeviceKey> => {
  const deviceKey = await handshake(deviceIp);
  const loginDeviceRequest =
    {
      "method": "login_device",
      "params": {
          "username": base64Encode(shaDigest(email)),
          "password": base64Encode(password)
      },
      "requestTimeMils": 0
  }

  const loginDeviceResponse =  await securePassthrough(loginDeviceRequest, deviceKey);
  deviceKey.token = loginDeviceResponse.token;
  return deviceKey;
}

export const turnOn = async (deviceKey: TapoDeviceKey, deviceOn: boolean = true) => {
  const turnDeviceOnRequest = {
    "method": "set_device_info",
    "params":{
      "device_on": deviceOn,
    },
    "terminalUUID": uuidv4()
  }
  await securePassthrough(turnDeviceOnRequest, deviceKey)
}

export const turnOff = async (deviceKey: TapoDeviceKey) => {
  return turnOn(deviceKey, false);
}

// hue: 0 to 360
// saturation: 0 to 100
// brightness: 0 to 100
// colourTemp (in Kelvin): 2500 to 6500
export const setColourRaw = async (deviceKey: TapoDeviceKey, hue: any, saturation: any, brightness: any, colourTemp?: any) => {
  const params: any = {}
  if (typeof hue === 'number') params.hue = hue
  if (typeof saturation === 'number') params.saturation = saturation
  if (typeof brightness === 'number') params.brightness = brightness
  if (typeof colourTemp === 'number') params.color_temp = colourTemp

  const setColourRequest = {
    "method": "set_device_info",
    params
  }
  await securePassthrough(setColourRequest, deviceKey)
}

export const securePassthrough = async (deviceRequest: any, deviceKey: TapoDeviceKey):Promise<any> => {
  const encryptedRequest = encrypt(deviceRequest, deviceKey)
  const securePassthroughRequest = {
    "method": "securePassthrough",
    "params": {
        "request": encryptedRequest,
    }
  }

  const response = await axios({
    method: 'post',
    url: `http://${deviceKey.deviceIp}/app?token=${deviceKey.token}`,
    data: securePassthroughRequest,
    headers: {
      "Oatmeal-Raisin": deviceKey.sessionCookie
    }
  })

  checkError(response.data);

  const decryptedResponse = decrypt(response.data.result.response, deviceKey);
  checkError(decryptedResponse);

  return decryptedResponse.result;
}

export const checkError = (responseData: any) => {
  const errorCode = responseData["error_code"];
  if (errorCode) {
    switch (errorCode) {
      case 0: return;
      case -1010: throw new Error("Invalid public key length");
      case -1012: throw new Error("Invalid terminal UUID");
      case -1501: throw new Error("Invalid request or credentials");
      case -1002: throw new Error("Incorrect request");
      case -1003: throw new Error("JSON format error");
      case -20601: throw new Error("Incorrect email or password");
      case -20675: throw new Error("Cloud token expired or invalid");
      case 9999: throw new Error("Device token expired or invalid");
      default: throw new Error(`Unexpected Error Code: ${errorCode} (${responseData["msg"]})`);
    }

  }
}

export const checkTapoCareError = (responseData: any) => {
  const errorCode = responseData?.code;
  if (errorCode) {
    throw new Error(`Unexpected Error Code: ${errorCode} (${responseData["message"]})`);
  }
}
