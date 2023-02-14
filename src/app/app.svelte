<script lang="ts">
  import { initAudio, getAudioState, pollForAudioCapture } from './addon'
  import type { AudioState } from './addon'
  import Group from './group.svelte'
  import StatusBar from './status-bar.svelte'
  import Voice from './voice/voice.svelte'
  import * as lights from './lights/lights'

  const VOICE_TRAINING_MODE = true

  const config = [{
    groupId: 1,
    label: 'Hyunjin',
    ipAddress: '127.0.0.1',
    values: [{
      label: 'hue',
      rangeLow: 0,
      rangeHigh: 360,
      digitCount: 3
    }, {
      label: 'sat',
      rangeLow: 0,
      rangeHigh: 100,
      digitCount: 3
    }, {
      label: 'bri',
      rangeLow: 0,
      rangeHigh: 100,
      digitCount: 3
    }, {
      label: 'temp',
      rangeLow: 2500,
      rangeHigh: 6500,
      digitCount: 4
    }]
  }, {
    groupId: 2,
    label: 'Heejin',
    ipAddress: '127.0.0.1',
    values: [{
      label: 'hue',
      rangeLow: 0,
      rangeHigh: 360,
      digitCount: 3
    }, {
      label: 'sat',
      rangeLow: 0,
      rangeHigh: 100,
      digitCount: 3
    }, {
      label: 'bri',
      rangeLow: 0,
      rangeHigh: 100,
      digitCount: 3
    }, {
      label: 'temp',
      rangeLow: 2500,
      rangeHigh: 6500,
      digitCount: 4
    }]
  }]

  let data: App.ValueData[][] = [
    [
      { digitPos: 0, value: 0 },
      { digitPos: 0, value: 0 },
      { digitPos: 0, value: 0 },
      { digitPos: 0, value: null }
    ],
    [
      { digitPos: 0, value: 0 },
      { digitPos: 0, value: 0 },
      { digitPos: 0, value: 0 },
      { digitPos: 0, value: null }
    ]
  ]

  let audioState: AudioState = { envelopeVal: 0.0, capturing: false }
  let sendAudioCapture = null
  let activeCode = [0, 0]
  let statusBarComponent: StatusBar = null
  let rects: App.GroupRects[] = []
  let markerElem: HTMLElement
  let mainElem: HTMLElement
  let mainRect: DOMRect
  $: mainRect = mainElem && mainElem.getBoundingClientRect()

  $: rects.forEach((rect, i) => {
    if (!markerElem || !mainRect) return

    if (activeCode[0] === 0) {
      markerElem.style.left = `${mainRect.left}px`
      markerElem.style.top = `${mainRect.top + 66}px`
      markerElem.style.width = `${mainRect.width}px`
      markerElem.style.height = `${mainRect.height - 66}px`
      return
    }

    if (activeCode[0] !== i + 1) return

    const j = activeCode[1]
    if (j === 0) {
      markerElem.style.left = `${rect.groupRect.left}px`
      markerElem.style.top = `${rect.groupRect.top}px`
      markerElem.style.width = `${rect.groupRect.width}px`
      markerElem.style.height = `${rect.groupRect.height}px`
    } else {
      markerElem.style.left = `${rect.valueRects[j-1].left - 10}px`
      markerElem.style.top = `${rect.valueRects[j-1].top}px`
      markerElem.style.width = `${rect.valueRects[j-1].width + 20}px`
      markerElem.style.height = `${rect.valueRects[j-1].height + 10}px`
    }
  })

  const initDevices = async () => {
    config.forEach(async (device) => {
      if (device.ipAddress) await lights.startSession(device.label, device.ipAddress)
    })
  }

  const onToken = ((token: string) => {
    statusBarComponent.addToken(token)

    const l2ValuesCount = (): number => config[activeCode[0]-1].values.length
    const valueData = (): App.ValueData => data[activeCode[0]-1][activeCode[1]-1]
    const valueConfig = (): App.ValueConfig => config[activeCode[0]-1].values[activeCode[1]-1]

    switch (token) {
      case 'top':
        activeCode = [0, 0]
        break
      case 'next':
        if (activeCode[0] !== 0 && activeCode[1] === 0) {
          // Move next on first level
          activeCode[0] = activeCode[0] === config.length ? 1 : activeCode[0]+1
        } else if (activeCode[0] !== 0 && activeCode[1] !== 0) {
          // Move next on second level
          activeCode[1] = activeCode[1] === l2ValuesCount() ? 1 : activeCode[1]+1
          valueData().digitPos = 0
        }
        break
      case 'null':
        if (activeCode[0] !== 0 && activeCode[1] !== 0) {
          valueData().digitPos = 0
          valueData().value = null
        }
        break
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
      case '9':
      case '0':
        const num = parseInt(token)
        if (activeCode[0] === 0) {
          // Go down into first level
          if (num > 0 && num <= config.length) activeCode[0] = num
        } else if (activeCode[1] === 0) {
          // Go down into second level
          if (num > 0 && num <= l2ValuesCount()) {
            activeCode[1] = num
            valueData().digitPos = 0
          }
        } else {
          // Change a value
          if (valueData().value === null) {
            valueData().digitPos = 0
            valueData().value = 0
          }
          // const multiplier = Math.pow(10, valueData().digitPos)
          // // Remove existing digit first
          // valueData().value! -= multiplier * (Math.floor(valueData().value!/multiplier) % 10)
          // valueData().value! += num * multiplier
          if (valueData().digitPos === 0) {
            valueData().value = num
          } else {
            valueData().value = num + 10 * valueData().value!
          }

          if (valueData().digitPos++ === valueConfig().digitCount) {
            valueData().digitPos = 0
          }

          if (valueData().value! > valueConfig().rangeHigh) {
            valueData().value = valueConfig().rangeHigh
          }
        }
        break
    }

    // Send data to lights
    config.forEach(async (device, i) => {
      if (device.ipAddress) {
        await lights.setState(device.label, data[i][0].value, data[i][1].value, data[i][2].value, data[i][3].value)
      }
    })

    // Reactivity is only triggered by assignments
    data = data
  })

  initDevices().then(() => {
    const initAudioResult = initAudio()
    if (initAudioResult < 0) {
      console.error('initAudio failed', initAudioResult)
    }
  })

  setInterval(() => {
    if (statusBarComponent === null) return
    getAudioState(audioState)

    const audioCapture = pollForAudioCapture()
    if (audioCapture !== null && sendAudioCapture !== null) {
      const transcript = sendAudioCapture(audioCapture)
      if (transcript !== null) onToken(transcript)
    }

    // assignment to trigger reactivity for status bar
    audioState = audioState
  }, 40)
</script>

<div id="main" bind:this={mainElem}>
  <div id="marker" bind:this={markerElem}></div>
  <StatusBar audioState={audioState} bind:this={statusBarComponent} />
  {#each config as groupConfig, i}
    <Group
      config={groupConfig}
      currentValues={data[i]}
      bind:rects={rects[i]}
    />
  {/each}
</div>

<Voice trainingMode={VOICE_TRAINING_MODE} bind:onAudioCapture={sendAudioCapture} />

<style>
  :global(body) {
    display: flex;
    margin: 0px;
    font-family: sans-serif;
    background-color: rgb(230, 235, 216);
    position: relative;
  }
 
  #main {
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
    margin: 20px 0px 0px 20px;
  }

  #marker {
    position: absolute;
    box-sizing: border-box;
    border: 2px solid rgb(211, 130, 225);
    transition: all 0.3s ease;
    z-index: 1;
  }
</style>
