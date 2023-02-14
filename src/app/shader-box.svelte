<script lang="ts">
  export let width = 0
  export let height = 0
  export let vertShaderCode = null
  export let fragShaderCode = null
  // NOTE: only scalar float uniforms are supported at the moment
  export let uniforms: { [key: string]: number } = null
  
  let dpr = window.devicePixelRatio

  let glInitDone = false
  let canvasElem: HTMLCanvasElement
  let gl: WebGLRenderingContext
  let program: WebGLProgram
  let uniformLocs: { [key: string]: WebGLUniformLocation } | null = null

  const createShader = (type: number, code: string) => {
    const shader = gl.createShader(type)
    gl.shaderSource(shader, code)
    gl.compileShader(shader)

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn(`Error compiling ${type === gl.VERTEX_SHADER ? 'vertex' : 'fragment'} shader:`)
      console.warn(gl.getShaderInfoLog(shader))
      return null
    }

    return shader
  }

  $: (() => {
    if (uniformLocs == null) return

    for (const [name, val] of Object.entries(uniforms)) {
      gl.uniform1f(uniformLocs[name], val)
    }

    gl.drawArrays(gl.TRIANGLES, 0, 6)
  })()

  $: (() => {
    if (glInitDone || !canvasElem || !vertShaderCode || !fragShaderCode || !uniforms) return
    gl = canvasElem.getContext('webgl2')

    const vertShader = createShader(gl.VERTEX_SHADER, vertShaderCode)
    const fragShader = createShader(gl.FRAGMENT_SHADER, fragShaderCode)
    if (!vertShader || !fragShader) return

    program = gl.createProgram()
    gl.attachShader(program, vertShader)
    gl.attachShader(program, fragShader)
    gl.linkProgram(program)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn('Error linking shader program:')
      console.warn(gl.getProgramInfoLog(program))
      return
    }

    gl.useProgram(program)

    uniformLocs = {}
    for (const name in uniforms) {
      uniformLocs[name] = gl.getUniformLocation(program, name)
    }

    const uScalingFactor = gl.getUniformLocation(program, 'uScalingFactor')
    gl.uniform2fv(uScalingFactor, [dpr, dpr])

    const vertArray = new Float32Array([ -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, -0.5 ])
    const vertBuf = gl.createBuffer()
    const vertNumComponents = 2
    const vertCount = vertArray.length / vertNumComponents

    gl.bindBuffer(gl.ARRAY_BUFFER, vertBuf)
    gl.bufferData(gl.ARRAY_BUFFER, vertArray, gl.STATIC_DRAW)

    const aVertPos = gl.getAttribLocation(program, 'VertPos')

    gl.enableVertexAttribArray(aVertPos)
    gl.vertexAttribPointer(aVertPos, vertNumComponents, gl.FLOAT, false, 0, 0)

    gl.drawArrays(gl.TRIANGLES, 0, vertCount)

    glInitDone = true
  })()
</script>

<canvas class={$$props.class} width={dpr*width} height={dpr*height} bind:this={canvasElem} style="width: {width}px; height: {height}px;">
</canvas>

<style>
  canvas {
    background-color: white;
  }
</style>
