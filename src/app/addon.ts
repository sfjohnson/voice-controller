const addon = require('./voice-controller.node')

export interface AudioState {
  envelopeVal: number
  capturing: boolean
}

export const initAudio: () => number = addon.initAudio
export const getAudioState: (audioState: AudioState) => null | AudioState = addon.getAudioState
export const pollForAudioCapture: () => null | Float32Array = addon.pollForAudioCapture
