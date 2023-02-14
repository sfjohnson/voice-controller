<script lang="ts">
  import ShaderBox from './shader-box.svelte'
  import hslPickerFrag from '../shaders/hsl-picker.frag'
  import hslPickerVert from '../shaders/basic.vert'

  const VIS_HEIGHT = 170
  const VIS_WIDTH = 50

  // export let rangeLow = 0
  // export let rangeHigh = 0
  export let valueId = 0
  export let label = ''
  export let currentValues: App.ValueData[] = []

  // $: currentHeight = currentValue === null ? VIS_HEIGHT : VIS_HEIGHT * (1 - (currentValue-rangeLow) / (rangeHigh-rangeLow))

  let containerElem: Element
  export let containerRect
  $: containerRect = containerElem && containerElem.getBoundingClientRect()

  const getCurrentValue = (index: number) => {
    if (index < 0 || index >= currentValues.length) return -1
    if (currentValues[index].value === null) return -1
    return currentValues[index].value
  }

  $: visUniforms = currentValues && {
    uType: valueId - 1,
    uHue: getCurrentValue(0),
    uSat: getCurrentValue(1),
    uBri: getCurrentValue(2),
    uMyValue: getCurrentValue(valueId - 1)
  }

  $: valueTextColour = (() => {
    // brightness text is always white
    if (valueId === 3) return 'white'
    // colour temp text is always black
    if (valueId === 4) return 'black'
    return currentValues[2].value < 50.0 ? 'white' : 'black'
  })()
</script>

<div class="main-container" bind:this={containerElem}>
  <p>
    <span class="id">{valueId}</span>
    <span class="label">{label}</span>
  </p>
  <div class="vis-container" style="height: {VIS_HEIGHT}px;">
    <!-- <div class="vis" style="height: {currentHeight}px;"></div> -->
    <ShaderBox
      class="vis"
      width={VIS_WIDTH}
      height={VIS_HEIGHT}
      vertShaderCode={hslPickerVert}
      fragShaderCode={hslPickerFrag}
      uniforms={visUniforms}
    />
    <p style="color: {valueTextColour};">{currentValues[valueId-1].value}</p>
  </div>
</div>

<style>
  .main-container {
    margin: -5px 20px 20px 20px;
  }

  p {
    margin: 5px 0px 0px 0px;
  }

  span.id {
    font-weight: bold;
  }

  span.label {
    font-size: smaller;
  }
 
  .vis-container {
    position: relative;
    margin: 5px 0px 0px 0px;
    background-color: rgb(236, 202, 160);
    width: 50px;
  }

  .vis-container p {
    position: absolute;
    margin: 0px 0px 5px 0px;
    bottom: 0px;
    width: inherit;
    text-align: center;
    font-size: smaller;
  }

  /* .vis {
    background-color: #e5e5e5;
    width: inherit;
  } */
</style>
