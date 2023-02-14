<script lang="ts">
  import ColourValue from './colour-value.svelte'

  export let config: App.GroupConfig = {
    groupId: 0,
    label: '',
    values: []
  }

  export let currentValues: App.ValueData[] = []
  export let rects: App.GroupRects

  let containerElem: Element
  let valueRects: DOMRect[] = []

  $: if (containerElem) {
    rects = {
      groupRect: containerElem.getBoundingClientRect(),
      valueRects
    }
  }
</script>

<div class="main-container" bind:this={containerElem}>
  <h2>
    <span>{config.groupId}</span>
    <span>{config.label}</span>
  </h2>
  <div class="value-container">
    {#each config.values as value, i}
      <ColourValue
        rangeLow={value.rangeLow}
        rangeHigh={value.rangeHigh}
        valueId={i+1}
        label={value.label}
        currentValues={currentValues}
        bind:containerRect={valueRects[i]}
      />
    {/each}
  </div>
</div>

<style>
  .main-container {
    display: flex;
    flex: 1;
    flex-direction: column;
    background-color: white;
  }

  .value-container {
    display: flex;
  }

  h2 {
    margin: 15px 0px 20px 20px;
    font-size: larger;
  }

  h2 span:last-child {
    font-weight: normal;
  }
</style>
