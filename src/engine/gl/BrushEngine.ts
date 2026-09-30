import type { Brush } from '@/engine/brushes/library'
import type { StrokePoint } from '@/model/types'

export interface Dab {
  x: number
  y: number
  size: number
  flow: number
  angle: number
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/**
 * Converts a growing polyline of input samples into evenly spaced textured
 * dabs, applying the brush's pressure/velocity dynamics. Call `addPoints`
 * incrementally as the stroke grows; it returns only the *new* dabs to render.
 */
export class StrokeStamper {
  private last: StrokePoint | null = null
  private acc = 0 // distance travelled since the last emitted dab
  private nextSpacing = 1
  private oriented: boolean

  constructor(private brush: Brush, private baseSize: number) {
    this.oriented = brush.shape === 'chalk'
  }

  private dabSize(pressure: number, speedNorm: number): number {
    const d = this.brush.dynamics
    const pFactor = 1 - d.pressureSize + d.pressureSize * pressure
    let scale = d.minSize + (1 - d.minSize) * pFactor
    scale *= 1 - d.velocitySize * speedNorm
    return Math.max(0.75, this.baseSize * scale)
  }

  private dabFlow(pressure: number): number {
    const d = this.brush.dynamics
    const fFactor = 1 - d.pressureFlow + d.pressureFlow * pressure
    return this.brush.flow * (d.minFlow + (1 - d.minFlow) * fFactor)
  }

  private spacingFor(size: number): number {
    return Math.max(1, size * this.brush.spacing)
  }

  private makeDab(x: number, y: number, pressure: number, speedNorm: number, dir: number): Dab {
    const size = this.dabSize(pressure, speedNorm)
    const j = this.brush.jitter * size
    const jx = j > 0 ? (Math.random() - 0.5) * j : 0
    const jy = j > 0 ? (Math.random() - 0.5) * j : 0
    return {
      x: x + jx,
      y: y + jy,
      size,
      flow: this.dabFlow(pressure),
      angle: this.oriented ? dir : 0,
    }
  }

  addPoints(points: StrokePoint[]): Dab[] {
    const dabs: Dab[] = []
    for (const pt of points) {
      if (!this.last) {
        const dab = this.makeDab(pt.x, pt.y, pt.p, 0, 0)
        dabs.push(dab)
        this.last = pt
        this.acc = 0
        this.nextSpacing = this.spacingFor(dab.size)
        continue
      }
      const dx = pt.x - this.last.x
      const dy = pt.y - this.last.y
      const segLen = Math.hypot(dx, dy)
      if (segLen < 0.001) {
        this.last = pt
        continue
      }
      const dir = Math.atan2(dy, dx)
      const speedNorm = Math.min(1, segLen / (this.baseSize * 1.5 + 4))
      let remaining = segLen
      let cursor = 0
      while (this.acc + remaining >= this.nextSpacing) {
        const need = this.nextSpacing - this.acc
        cursor += need
        remaining -= need
        const t = cursor / segLen
        const p = lerp(this.last.p, pt.p, t)
        const dab = this.makeDab(
          this.last.x + dx * t,
          this.last.y + dy * t,
          p,
          speedNorm,
          dir,
        )
        dabs.push(dab)
        this.acc = 0
        this.nextSpacing = this.spacingFor(dab.size)
      }
      this.acc += remaining
      this.last = pt
    }
    return dabs
  }
}
