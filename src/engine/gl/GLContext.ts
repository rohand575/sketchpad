import type { GrainKind, ShapeKind } from '@/engine/brushes/library'

export interface GLTarget {
  tex: WebGLTexture
  fbo: WebGLFramebuffer
  width: number
  height: number
}

export class Program {
  readonly program: WebGLProgram
  private locs = new Map<string, WebGLUniformLocation | null>()
  constructor(
    private gl: WebGL2RenderingContext,
    vs: string,
    fs: string,
  ) {
    this.program = linkProgram(gl, vs, fs)
  }
  use(): void {
    this.gl.useProgram(this.program)
  }
  loc(name: string): WebGLUniformLocation | null {
    if (!this.locs.has(name)) {
      this.locs.set(name, this.gl.getUniformLocation(this.program, name))
    }
    return this.locs.get(name) ?? null
  }
}

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh)
    gl.deleteShader(sh)
    throw new Error(`Shader compile error: ${log}`)
  }
  return sh
}

function linkProgram(gl: WebGL2RenderingContext, vsSrc: string, fsSrc: string): WebGLProgram {
  const vs = compile(gl, gl.VERTEX_SHADER, vsSrc)
  const fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc)
  const p = gl.createProgram()!
  gl.attachShader(p, vs)
  gl.attachShader(p, fs)
  gl.bindAttribLocation(p, 0, 'aPos')
  gl.linkProgram(p)
  gl.deleteShader(vs)
  gl.deleteShader(fs)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(p)
    gl.deleteProgram(p)
    throw new Error(`Program link error: ${log}`)
  }
  return p
}

/** Shared low-level GL helpers + a centered unit quad VAO. */
export class GLContext {
  readonly gl: WebGL2RenderingContext
  readonly quadVao: WebGLVertexArrayObject

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      preserveDrawingBuffer: false,
      desynchronized: true,
    })
    if (!gl) throw new Error('WebGL2 not available')
    this.gl = gl

    // Centered quad [-0.5, 0.5] as a triangle strip.
    const buf = gl.createBuffer()!
    const verts = new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5])
    const vao = gl.createVertexArray()!
    gl.bindVertexArray(vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    gl.bindVertexArray(null)
    this.quadVao = vao
  }

  program(vs: string, fs: string): Program {
    return new Program(this.gl, vs, fs)
  }

  createTexture(
    w: number,
    h: number,
    data: ArrayBufferView | null = null,
    opts: { filter?: number; wrap?: number } = {},
  ): WebGLTexture {
    const gl = this.gl
    const tex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data)
    const filter = opts.filter ?? gl.LINEAR
    const wrap = opts.wrap ?? gl.CLAMP_TO_EDGE
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap)
    gl.bindTexture(gl.TEXTURE_2D, null)
    return tex
  }

  createTarget(w: number, h: number): GLTarget {
    const gl = this.gl
    const tex = this.createTexture(w, h)
    const fbo = gl.createFramebuffer()!
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    return { tex, fbo, width: w, height: h }
  }

  deleteTarget(t: GLTarget): void {
    this.gl.deleteTexture(t.tex)
    this.gl.deleteFramebuffer(t.fbo)
  }

  /** Bind a render target (or null for the default framebuffer) and set viewport. */
  bindTarget(t: GLTarget | null, screenW = 0, screenH = 0): void {
    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fbo : null)
    gl.viewport(0, 0, t ? t.width : screenW, t ? t.height : screenH)
  }

  drawQuad(): void {
    const gl = this.gl
    gl.bindVertexArray(this.quadVao)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }
}

// --- Procedural stamp/grain textures (no binary assets) ---

const SHAPE_SIZE = 128
const GRAIN_SIZE = 256

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export function generateShapeData(kind: ShapeKind): Uint8Array {
  const n = SHAPE_SIZE
  const out = new Uint8Array(n * n * 4)
  const c = (n - 1) / 2
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = (x - c) / (n / 2)
      const dy = (y - c) / (n / 2)
      const r = Math.hypot(dx, dy)
      let a = 0
      if (kind === 'hard') {
        a = 1 - smoothstep(0.9, 1.0, r)
      } else if (kind === 'soft') {
        a = Math.pow(Math.max(0, 1 - r), 1.6)
      } else {
        // chalk: grainy disc
        const disc = 1 - smoothstep(0.8, 1.0, r)
        a = disc * (0.35 + 0.65 * Math.random())
      }
      const i = (y * n + x) * 4
      out[i] = 255
      out[i + 1] = 255
      out[i + 2] = 255
      out[i + 3] = Math.round(Math.max(0, Math.min(1, a)) * 255)
    }
  }
  return out
}

export function generateGrainData(kind: Exclude<GrainKind, null>): Uint8Array {
  const n = GRAIN_SIZE
  const out = new Uint8Array(n * n * 4)
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      let v = 1
      if (kind === 'pencil') {
        v = 0.35 + 0.65 * Math.random()
      } else if (kind === 'paper') {
        v = 0.55 + 0.45 * Math.random()
      } else {
        // canvas weave
        const weave = 0.5 + 0.25 * (Math.sin(x * 0.5) + Math.sin(y * 0.5))
        v = Math.max(0, Math.min(1, 0.45 * weave + 0.55 * (0.6 + 0.4 * Math.random())))
      }
      const i = (y * n + x) * 4
      const b = Math.round(v * 255)
      out[i] = b
      out[i + 1] = b
      out[i + 2] = b
      out[i + 3] = 255
    }
  }
  return out
}

export const TEXTURE_SIZES = { shape: SHAPE_SIZE, grain: GRAIN_SIZE }
