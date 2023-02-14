// https://github.com/dickydoouk/tp-link-tapo-connect

export type TapoDevice = {
    deviceType: string;
    fwVer: string;
    appServerUrl: string;
    deviceRegion: string;
    deviceId: string;
    deviceName: string;
    deviceHwVer: string;
    alias: string;
    deviceMac: string;
    oemId: string;
    deviceModel: string;
    hwId: string;
    fwId: string;
    isSameRegion: boolean;
    status: number;

    ip?: string
  }

  export type TapoDeviceKey = {
    key: Buffer;
    iv: Buffer;
    deviceIp: string;
    sessionCookie: string;
    token?: string;
  }
