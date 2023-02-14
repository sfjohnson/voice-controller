<script lang="ts">
  import ShaderBox from './shader-box.svelte'
  import audioBoxFrag from '../shaders/audio-box.frag'
  import audioBoxVert from '../shaders/basic.vert'

  const TOKEN_LIST_LENGTH = 100
  const AUDIO_LEVEL_SCALE = 5

  let tokenList: string[] = []

  export const addToken = (token: string) => {
    tokenList.push(token)
    if (tokenList.length >= TOKEN_LIST_LENGTH) {
      tokenList.shift()
    }
    tokenList = tokenList
  }

  export let audioState = { envelopeVal: 0.0, capturing: false }

  $: audioBoxUniforms = {
    uLevel: AUDIO_LEVEL_SCALE*audioState.envelopeVal,
    uCapturing: audioState.capturing ? 1.0 : 0.0
  }
</script>

<div class="main-container">
  <div class="token-list-container">
    <div class="fade-container">
      {#each tokenList as token}
        <p class="token">{token}</p>
      {/each}
    </div>
  </div>
  <ShaderBox
    class="audio-box"
    width={46}
    height={46}
    vertShaderCode={audioBoxVert}
    fragShaderCode={audioBoxFrag}
    uniforms={audioBoxUniforms}
  />
</div>

<style>
  .main-container {
    display: flex;
    flex: 1 0 100%;
    width: 0px;
  }

  .token-list-container {
    background-color: white;
    overflow: hidden;
    flex: 1;
  }

  .main-container :global(.audio-box) {
    margin: 0px 0px 0px 10px;
  }

  .fade-container {
    display: flex;
    justify-content: flex-end;
    -webkit-mask-image: -webkit-linear-gradient(right, rgba(0, 0, 0, 1) 80%, rgba(0, 0, 0, 0));
    mask-image: linear-gradient(right, rgba(0, 0, 0, 1) 80%, rgba(0, 0, 0, 0));
    height: 46px;
  }

  .token {
    background-color: #e5e5e5;
    margin: 10px 10px 10px 0px;
    padding: 5px 6px;
    box-sizing: border-box;
    height: 26px;
    font-size: smaller;
  }
</style>
