// Halo: analog hands over three concentric activity rings (steps, calories, stand).
// Everything else sits in four groups on the compass points around the rings:
//   top    date, battery beneath          bottom  temperature, today's high/low beneath
//   left   ring values, in ring colours   right   heart rate, SpO2, distance Laid out in 466px space for the Active 2 Round.
// All text is pre-rendered Inter glyphs (see make-glyphs.js); the system font is never used.
// Steps, calories and weather numbers are bound to system data types, so the firmware fills them
// with the same values (and units) the watch's own apps show.

import { GLYPHS } from './glyphs'

const CX = 233
const CY = 233

const C = {
  bg: 0x000000
}

// Outer to inner. track is the same hue at low brightness so an empty ring still reads.
const RINGS = [
  { key: 'steps', r: 130, color: 0xffa62b, track: 0x3a2609, fallbackGoal: 8000 },
  { key: 'kcal', r: 100, color: 0xa78bfa, track: 0x2a2341, fallbackGoal: 400 },
  { key: 'stand', r: 70, color: 0x2dd4bf, track: 0x0d3531, fallbackGoal: 12 }
]
const RING_WIDTH = 24
const RING_OUTER = RINGS[0].r + RING_WIDTH / 2

// Spacing: rows inside a group sit on a tight 26px pitch; groups are separated by the rings.
const LAYOUT = {
  dateY: 36,
  batteryY: 62,
  tempY: 384,
  hiloY: 412,
  rowY: [199, 225, 251],
  stackInset: RING_OUTER + 10,
  stackW: 80
}

const digits = (set) => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => 'g/' + set + '/' + n + '.png')
const NORMAL = hmUI.show_level.ONLY_NORMAL
const AOD = hmUI.show_level.ONAL_AOD

// ARC angles are measured from 3 o'clock; this takes clock degrees (0 = 12 o'clock).
const clock = (deg) => deg - 90

// Wake animation: rings sweep in one after another.
const SWEEP_MS = 700
const STAGGER_MS = 90
const FRAME_MS = 33
const POLL_MS = 30000
// Sweeping second hand: redraw interval while the screen is on (0.2° per frame at 33ms).
const SWEEP_FRAME_MS = 33

// M3 emphasized-decelerate: cubic-bezier(0.05, 0.7, 0.1, 1.0).
function ease(t) {
  const bez = (a, b, s) => 3 * a * s * (1 - s) * (1 - s) + 3 * b * s * s * (1 - s) + s * s * s
  let lo = 0, hi = 1, s = t
  for (let i = 0; i < 12; i++) {
    s = (lo + hi) / 2
    if (bez(0.05, 0.1, s) < t) lo = s
    else hi = s
  }
  return bez(0.7, 1, s)
}

function sensor(id, event, onChange) {
  try {
    const s = hmSensor.createSensor(id)
    if (event !== undefined) s.addEventListener(event, onChange)
    return s
  } catch (e) {
    return null
  }
}

function arc(r, from, to, color, width, level) {
  return hmUI.createWidget(hmUI.widget.ARC, {
    x: CX - r, y: CY - r, w: r * 2, h: r * 2,
    start_angle: clock(from), end_angle: clock(to),
    color, line_width: width, show_level: level || NORMAL
  })
}

function img(x, y, src, level) {
  return hmUI.createWidget(hmUI.widget.IMG, { x, y, src, show_level: level || NORMAL })
}

// Image-glyph number. Pass type to let the firmware supply the value; otherwise set it with
// setProperty(hmUI.prop.TEXT, ...).
function number(o) {
  const set = GLYPHS.digits[o.set]
  const opts = {
    x: o.x, y: o.y, w: o.w, h: set.h,
    font_array: digits(o.set), h_space: o.space || 0, align_h: o.align,
    negative_image: 'g/' + o.set + '/minus.png',
    show_level: o.level || NORMAL
  }
  if (o.type) opts.type = o.type
  else opts.text = '0'
  const unit = o.unit || (o.degree && 'g/' + o.set + '/deg.png')
  if (unit) {
    const imperial = o.imperialUnit || unit
    Object.assign(opts, {
      unit_en: unit, unit_sc: unit, unit_tc: unit,
      imperial_unit_en: imperial, imperial_unit_sc: imperial, imperial_unit_tc: imperial
    })
  }
  if (o.dot) opts.dot_image = 'g/' + o.set + '/dot.png'
  return hmUI.createWidget(hmUI.widget.TEXT_IMG, opts)
}

// Weekday box (right-aligned glyphs) then the day number, centred as a pair.
function dateRow(set, y, level) {
  const wk = GLYPHS.week[set]
  const gap = 7
  const dayW = GLYPHS.digits[set].w * 2
  const x = CX - Math.round((wk.w + gap + dayW) / 2)
  return {
    set,
    week: img(x, y, 'g/' + set + '/wk0.png', level),
    // Box is wider than two digits: the firmware clips glyphs that touch the right edge.
    day: number({ x: x + wk.w + gap, y, w: dayW + 24, set, align: hmUI.align.LEFT, level })
  }
}

// Hour and minute hands. The second hand is drawn separately so it can sweep.
function hands(level) {
  hmUI.createWidget(hmUI.widget.TIME_POINTER, {
    hour_centerX: CX, hour_centerY: CY, hour_posX: 8, hour_posY: 112, hour_path: 'hour.png',
    minute_centerX: CX, minute_centerY: CY, minute_posX: 7, minute_posY: 176, minute_path: 'minute.png',
    minute_cover_path: 'cap.png', minute_cover_x: CX - 10, minute_cover_y: CY - 10,
    show_level: level
  })
}

WatchFace({
  build() {
    hmUI.createWidget(hmUI.widget.FILL_RECT, { x: 0, y: 0, w: 466, h: 466, color: C.bg, show_level: NORMAL })

    this.rings = RINGS.map((def) => {
      arc(def.r, 0, 360, def.track, RING_WIDTH)
      return Object.assign({}, def, {
        widget: arc(def.r, 0, 0, def.color, RING_WIDTH),
        target: 0
      })
    })

    this.dates = [dateRow('date', LAYOUT.dateY), dateRow('dateAod', LAYOUT.dateY, AOD)]

    const L = hmUI.align
    const D = hmUI.data_type

    // Top: battery in small text under the date.
    number({ x: CX - 40, y: LAYOUT.batteryY, w: 80, set: 'tempSmall', align: L.CENTER_H, type: D.BATTERY, unit: 'g/unit/pctSmall.png' })

    // Left: one value per ring, outer to inner, right-aligned against the rings.
    const leftX = CX - LAYOUT.stackInset - LAYOUT.stackW
    ;[['compSteps', D.STEP], ['compKcal', D.CAL], ['compStand', D.STAND]].forEach(([set, type], i) => {
      number({ x: leftX, y: LAYOUT.rowY[i], w: LAYOUT.stackW, set, align: L.RIGHT, type })
    })

    // Right: body and distance, left-aligned against the rings, each with a small unit.
    const rightX = CX + LAYOUT.stackInset
    const unit = (u) => 'g/unit/' + u + '.png'
    number({ x: rightX, y: LAYOUT.rowY[0], w: LAYOUT.stackW, set: 'comp', align: L.LEFT, type: D.HEART, unit: unit('bpm') })
    number({ x: rightX, y: LAYOUT.rowY[1], w: LAYOUT.stackW, set: 'comp', align: L.LEFT, type: D.SPO2, unit: unit('pct') })
    number({ x: rightX, y: LAYOUT.rowY[2], w: LAYOUT.stackW, set: 'comp', align: L.LEFT, type: D.DISTANCE, dot: true, unit: unit('km'), imperialUnit: unit('mi') })

    // Bottom: current temperature, today's high and low beneath (mirrors date over battery).
    number({ x: CX - 60, y: LAYOUT.tempY, w: 120, set: 'temp', align: L.CENTER_H, type: D.WEATHER_CURRENT, degree: true })
    const ry = LAYOUT.hiloY
    img(CX - 48, ry, 'g/label/hi.png')
    number({ x: CX - 48 + GLYPHS.labels.hi.w + 2, y: ry, w: 52, set: 'tempSmall', align: L.LEFT, type: D.WEATHER_HIGH, degree: true })
    img(CX + 10, ry, 'g/label/lo.png')
    number({ x: CX + 10 + GLYPHS.labels.lo.w + 2, y: ry, w: 52, set: 'tempSmall', align: L.LEFT, type: D.WEATHER_LOW, degree: true })

    hands(NORMAL)
    hands(AOD)

    this.secondHand = hmUI.createWidget(hmUI.widget.IMG, {
      x: 0, y: 0, w: 466, h: 466, src: 'second.png',
      pos_x: CX - 4, pos_y: CY - 186, center_x: CX, center_y: CY, angle: 0,
      show_level: NORMAL
    })
    img(CX - 10, CY - 10, 'cap.png')

    const ev = hmSensor.event
    const refresh = () => this.refreshStats(false)
    this.time = sensor(hmSensor.id.TIME, ev.MINUTEEND, () => this.refreshDate())
    this.step = sensor(hmSensor.id.STEP, ev.CHANGE, refresh)
    this.calorie = sensor(hmSensor.id.CALORIE, ev.CHANGE, refresh)
    this.stand = sensor(hmSensor.id.STAND, ev.CHANGE, refresh)

    hmUI.createWidget(hmUI.widget.WIDGET_DELEGATE, {
      resume_call: () => this.wake(),
      pause_call: () => this.sleep()
    })

    this.wake()
  },

  wake() {
    this.refreshDate()
    this.refreshStats(true)
    // Step and calorie change events can lag; re-read while the screen is on.
    this.stopTimer('pollTimer')
    this.pollTimer = timer.createTimer(POLL_MS, POLL_MS, () => this.refreshStats(false))
    this.startSweep()
  },

  // Angle comes from the millisecond clock each frame, so the hand never drifts.
  startSweep() {
    this.stopTimer('sweepTimer')
    const frame = () => {
      const ms = this.time.utc % 60000
      this.secondHand.setProperty(hmUI.prop.ANGLE, (ms / 60000) * 360)
    }
    frame()
    this.sweepTimer = timer.createTimer(SWEEP_FRAME_MS, SWEEP_FRAME_MS, frame)
  },

  sleep() {
    this.stopTimer('animTimer')
    this.stopTimer('pollTimer')
    this.stopTimer('sweepTimer')
  },

  refreshDate() {
    const t = this.time
    this.dates.forEach((row) => {
      row.week.setProperty(hmUI.prop.SRC, 'g/' + row.set + '/wk' + (t.week - 1) + '.png')
      row.day.setProperty(hmUI.prop.TEXT, '' + t.day)
    })
  },

  refreshStats(replay) {
    const val = (s, key) => (s && s[key] > 0 ? s[key] : 0)
    const sources = { steps: this.step, kcal: this.calorie, stand: this.stand }

    this.rings.forEach((ring) => {
      const s = sources[ring.key]
      ring.value = val(s, 'current')
      ring.goal = val(s, 'target') || ring.fallbackGoal
      ring.target = Math.min(ring.value / ring.goal, 1)
    })

    this.animate(replay)
  },

  // replay=true sweeps every ring in from empty; otherwise rings ease from where they are.
  animate(replay) {
    this.stopTimer('animTimer')
    const from = this.rings.map((r) => (replay ? 0 : r.shown || 0))
    const total = SWEEP_MS + STAGGER_MS * (this.rings.length - 1)
    let elapsed = 0

    const frame = () => {
      this.rings.forEach((ring, i) => {
        const local = Math.max(0, Math.min((elapsed - (replay ? i * STAGGER_MS : 0)) / SWEEP_MS, 1))
        ring.shown = from[i] + (ring.target - from[i]) * ease(local)
        ring.widget.setProperty(hmUI.prop.MORE, { start_angle: clock(0), end_angle: clock(360 * ring.shown) })
      })
      elapsed += FRAME_MS
      if (elapsed > total) this.stopTimer('animTimer')
    }
    frame()
    this.animTimer = timer.createTimer(FRAME_MS, FRAME_MS, frame)
  },

  stopTimer(name) {
    if (this[name]) {
      timer.stopTimer(this[name])
      this[name] = null
    }
  },

  onDestroy() {
    this.sleep()
  }
})
