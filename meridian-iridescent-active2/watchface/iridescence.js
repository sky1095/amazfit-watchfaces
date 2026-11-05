export const FRAME_COUNT = 32

// Local clock anchors: midnight, morning, afternoon, evening, night, next midnight.
export function dialFrame(date, tilt = 0) {
  const hours = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600
  const anchors = [[0, 0], [6, 8], [12, 16], [18, 24], [22, 29], [24, 32]]
  for (let i = 1; i < anchors.length; i++) {
    const [end, to] = anchors[i]
    if (hours < end) {
      const [start, from] = anchors[i - 1]
      const phase = Math.round(from + (to - from) * (hours - start) / (end - start))
      return ((phase + tilt) % FRAME_COUNT + FRAME_COUNT) % FRAME_COUNT
    }
  }
  return 0
}

// Gravity is low-pass filtered so walking and small hand tremors don't flash the dial.
export function createSheen(sensor, draw, now = () => Date.now()) {
  let active = false
  let gravity = null
  let lastTime = null
  let frame = -1
  const change = () => {
    if (!active) return
    const time = now()
    if (lastTime !== null && time - lastTime < 80) return
    const value = sensor.getCurrent()
    if (!value || ![value.x, value.y, value.z].every(Number.isFinite)) return
    const length = Math.sqrt(value.x * value.x + value.y * value.y + value.z * value.z)
    if (length < 100 || length > 2000) return
    const v = [value.x / length, value.y / length, value.z / length]
    const alpha = lastTime === null ? 1 : 1 - Math.exp(-(time - lastTime) / 180)
    gravity = gravity ? gravity.map((g, i) => g + alpha * (v[i] - g)) : v
    lastTime = time
    const phase = (gravity[0] * 0.65 + gravity[1] * 0.45 + (gravity[2] - 1) * 0.2)
    const next = ((Math.round(phase * FRAME_COUNT) % FRAME_COUNT) + FRAME_COUNT) % FRAME_COUNT
    if (next !== frame) { draw(next); frame = next }
  }
  return {
    start() {
      if (active) return
      active = true
      gravity = null
      lastTime = null
      try {
        sensor.onChange(change)
        sensor.start()
      } catch (error) {
        this.stop()
        throw error
      }
    },
    stop() {
      if (!active) return
      active = false
      try { sensor.offChange(change) } finally { sensor.stop() }
    }
  }
}
