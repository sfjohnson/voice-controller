// Adapted from https://github.com/shawkatq/voice-commands-demo

import Meyda from 'meyda'
import type { MeydaFeaturesObject } from 'meyda'
import DynamicTimeWarping from 'dynamic-time-warping'
const v8 = require('v8')

interface Elm {
  transcript: string
  weight: number
  confidence: number
}

interface MfccDistVal {
  dist: number
  transcript: string
}

interface MfccHistoryVal {
  mfcc: (Partial<MeydaFeaturesObject> | null)[]
  transcript: string
}

type CompFunc = (a: MfccDistVal, b: MfccDistVal) => number

type SetStateFunc = (msg: string) => void

/******************************************************************************
* Local Recognition and MFCC/DTW calculations 
* MFCC by Meyda: https://github.com/meyda/meyda
* DTW: https://github.com/GordonLesti/dynamic-time-warping
******************************************************************************/

// constants
export const dictionary = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'null', 'top', 'next']
const bufferSize = 2048
const _buffArrSize = 10 // 427 ms
const _minKnnConfidence = 0
const _minDTWDist = 1000
const K_factor = 3

// state
let mfccHistoryArr: MfccHistoryVal[] = []

export const serialiseState = (): Buffer => v8.serialize(mfccHistoryArr)
export const deserialiseState = (data: Buffer): void => mfccHistoryArr = v8.deserialize(data)

/**
 * train the system, assume that the passed audio data in the buffer fits the transcript
 * @param {*} _buffer 
 * @param {*} transcript 
 * @param {*} setStateFunc 
 */
export const train = (audioBuffer: Float32Array, transcript: string, setStateFunc: SetStateFunc) => {
  setStateFunc('training')

  // DEBUG: badness here
  // @ts-ignore
  Meyda.bufferSize = bufferSize

  // calculate mfcc data
  const bufferMfcc = createMfccMetric(audioBuffer)

  // save current mfcc for future recognitions
  mfccHistoryArr.push({
    mfcc: bufferMfcc,
    transcript: transcript
  })

  setStateFunc('training saved')
  return true
}

/**
 * try to recognize what the audio data in the buffer is
 * don't call this until training has been completed and mfccHistoryArr has enough variants 
 * @param {*} _buffer 
 * @param {*} setStateFunc 
 */
export const recognize = (audioBuffer: Float32Array, setStateFunc: SetStateFunc) => {
  // DEBUG: badness here
  // @ts-ignore
  Meyda.bufferSize = bufferSize

  // calculate mfcc data
  const bufferMfcc = createMfccMetric(audioBuffer)

  setStateFunc('recognizing')

  // calculate DTW distance from all available trained data
  const mfccDistArr = calculateDistanceArr(bufferMfcc)

  // get closest one using knn
  let knnClosest: Elm | null = null
  if (K_factor <= mfccHistoryArr.length) {
    knnClosest = getMostSimilarKnn(mfccDistArr, compareMfcc, K_factor)
    if (knnClosest && knnClosest.confidence < _minKnnConfidence) {
      knnClosest = null
    }

    if (knnClosest && knnClosest.transcript !== '') {
      // save current mfcc for next recognitions
      mfccHistoryArr.push({
        mfcc: bufferMfcc,
        transcript: knnClosest.transcript
      })
    }
  }

  // validate that we have minimal recognition confidence
  if (!knnClosest || knnClosest.confidence < 0.75) {
    setStateFunc('not recognized')
    return null
  }

  setStateFunc('recognized')
  return knnClosest
}

/**
 * calculate DTW distance from dictionary mfcc history
 */
const calculateDistanceArr = (bufferMfcc: (Partial<MeydaFeaturesObject> | null)[]): MfccDistVal[] => {
  const mfccDistArr = []
  for (let i = 0; i < mfccHistoryArr.length; i++) {
    if (isInDictionary(mfccHistoryArr[i].transcript)) {
      let dtw = new DynamicTimeWarping(mfccHistoryArr[i].mfcc, bufferMfcc, EuclideanDistance)
      let dist = dtw.getDistance()
      mfccDistArr.push({
        dist: dist,
        transcript: mfccHistoryArr[i].transcript
      })
    }
  }

  return mfccDistArr
}

/**
 * search in dictionary
 */
const isInDictionary = (word: string) => {
  for (let i = 0; i < dictionary.length; i++) {
    if (dictionary[i] === word) return true
  }
  return false
}

/**
 * get the most similar transcript from audio mfcc history array, using Knn Algorithm
 */
const getMostSimilarKnn = (Items: MfccDistVal[], compFunc: CompFunc, k: number): Elm | null => {
  if (!Items || Items.length === 0) return null
  if (k > Items.length) return null

  let items = Items
  let _compFunc = compFunc

  items.sort(_compFunc)
  let kArr = items.slice(0, k)
  const simArr: Map<string, number> = new Map() // maps transcript to weight
  let maxElm: Elm = {
    transcript: '',
    weight: 0,
    confidence: 0
  }

  for (let i = 0; i < kArr.length; i++) {
    if (kArr[i].dist > _minDTWDist) continue

    let weight = simArr.get(kArr[i].transcript)
    if (typeof weight === 'undefined') weight = 0
    weight += 1000 / kArr[i].dist

    simArr.set(kArr[i].transcript, weight)

    if (maxElm.weight < weight) {
        maxElm.transcript = kArr[i].transcript
        maxElm.weight = weight
    }
  }

  if (maxElm && maxElm.transcript === '') return null

  if (maxElm) {
    // calculate confidence
    let sum = 0, count = 0
    for (let i = 0; i < items.length; i++) {
      if (items[i].transcript === maxElm.transcript) {
        sum = sum + items[i].dist
        count++
      }
    }
    maxElm.confidence = getGaussianKernel(sum / count)
  }

  return maxElm
}

const getGaussianKernel = (t: number) => Math.pow(Math.E, -1 / 2 * Math.pow(t / 1000, 2))

/**
 * calculate audio buffer mfcc data
 */
const createMfccMetric = (audioBuffer: Float32Array) => {
  const mfccMetricArr = []
  for (let i = 0; i < _buffArrSize; i++) {
    // DEBUG: optimise this shiz
    let bufferSlice = new Float32Array(bufferSize)
    for (let dstPos = 0; dstPos < bufferSize; dstPos++) {
      const srcPos = bufferSize*i + dstPos
      if (srcPos > audioBuffer.length) {
        bufferSlice[dstPos] = 0.0
      } else {
        bufferSlice[dstPos] = audioBuffer[srcPos]
      }
    }
    const mfccMetric = Meyda.extract('mfcc', bufferSlice)
    mfccMetricArr.push(mfccMetric)
  }

  return mfccMetricArr
}

/**
 * Euclidean Distance between two victors
 * @param {*} p 
 * @param {*} q 
 */
const EuclideanDistance = (p: any, q: any) => {
  let d = 0
  if (p.length !== q.length) return -1

  for (let i = 0; i < p.length; i++) {
    d = d + Math.pow(p[i] - q[i], 2)
  }

  return Math.sqrt(d)
}

/**
 * Mfcc object comparison
 * @param {*} a 
 * @param {*} b 
 */
const compareMfcc = (a: MfccDistVal, b: MfccDistVal) => {
  if (a.dist < b.dist) return -1
  if (a.dist > b.dist) return 1
  return 0
}
