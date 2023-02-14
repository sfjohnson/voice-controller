<script lang="ts">
  // Adapted from https://github.com/shawkatq/voice-commands-demo

  import * as Recognize from './recognize'
  import { Utils } from './utils'
  const { ipcRenderer } = require('electron')
  const fsp = require('fs').promises
  const path = require('path')

  export let trainingMode = false
  let modeMsg = ''
  let msg = 'click start'
  let statusMsg = ''
  let trained = false
  let currentTrainingIndex: number | null = null

  // then chain like it's 2012
  ipcRenderer.invoke('get-user-path').then((userPath) => {
    return fsp.readFile(path.join(userPath, 'training.data'))
  }).then((trainingData) => {
    if (trainingMode) return

    Recognize.deserialiseState(trainingData)
    trained = true
    console.log('Loaded training data from training.data')
    msg = 'Loaded training data from training.data, now we will try to guess what you are trying to say from the trained vocabulary.'
    modeMsg = 'recognizing mode'
  }).catch (() => {
    console.warn('Failed to load training data from training.data')
  })

  /**
   * stop recording data in the buffer, and process the signal
   */
  export const onAudioCapture = (samples: Float32Array) => {
    if (trainingMode) {
      // create blob to process it
      var blob = Utils.bufferToBlob(samples)
      if (!blob) return null

      // create a WAV file to listen to the recorded data
      Utils.getVoiceFile(blob)
    }

    if (trained) {
      let result = Recognize.recognize(samples, setStateMsgFunc)
      if (trainingMode) console.log(result)
      if (result) {
        msg = "Great! the result is ===> " + result.transcript + " <=== try more."
        return result.transcript
      } else {
        msg = "Didn't Got it! please try to Again loud and clear."
        return null
      }
    } else {
      let success = Recognize.train(samples, Recognize.dictionary[currentTrainingIndex! % Recognize.dictionary.length], setStateMsgFunc)
      traingNextWord(success)
      return null
    }
  }

  /**
   * Move to the next word to train the system.
   * Train the whole dictionary 4 times
   */
  const traingNextWord = async (success: boolean) => {
    if (success) {
      // next word
      let i = currentTrainingIndex! + 1;
      if (i > Recognize.dictionary.length * 4 - 1) {
        const userPath = await ipcRenderer.invoke('get-user-path')
        await fsp.writeFile(path.join(userPath, 'training.data'), Recognize.serialiseState())
        trained = true
        currentTrainingIndex = i
        msg = "training is finished, training data has been saved in training.data, now we will try to guess what you are trying to say from the trained vocabulary."
        modeMsg = "recognizing mode"
      }
      else {
        currentTrainingIndex = i
        msg = "Good! say the next word loud and clear, and wait until we process it.  ===>  " + Recognize.dictionary[i % Recognize.dictionary.length]
      }
    }
    else {
      msg = "we didn't got it, try again, say the next word loud and clear, and wait until we process it.    " + Recognize.dictionary[currentTrainingIndex! % Recognize.dictionary.length]
    }
  }

  const setStateMsgFunc = (msg: string) => {
    statusMsg = msg
  }

  const start = () => {
    if (!trained) {
      currentTrainingIndex = 0
      msg = "say the next word loud and clear, and wait until we process it.  ===>   " + Recognize.dictionary[0]
      modeMsg = "training mode"
    }
    else {
      modeMsg = "recognizing mode"
    }
  }
</script>

<div class="App" style="display: {trainingMode ? 'block' : 'none'}">
  <div class="row">
    <button on:click={start}>Start</button>
  </div>
  <div class="msgs">
    <span>{modeMsg}</span>
  </div>
  <div class="msgs">
    <span>{msg}</span>
  </div>
  <div class="msgs">
    <span>{statusMsg}</span>
  </div>
  <div id="audios-container"></div>
</div>

<style>
  .App {
    width: 780px;
  }
</style>