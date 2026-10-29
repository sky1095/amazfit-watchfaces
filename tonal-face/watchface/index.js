// Tonal: an original face built on Material 3. Palettes come from material-color-utilities
// (SchemeTonalSpot, dark) and motion uses M3's emphasized-decelerate easing.

// Pick a theme: 'blue', 'green', 'peach' or 'lavender'.
const THEME = 'blue'

const THEMES = {
  blue: { primary: 0xadc6ff, primaryContainer: 0x2b4678, onPrimaryContainer: 0xd8e2ff, secondaryContainer: 0x3f4759, onSecondaryContainer: 0xdbe2f9, tertiary: 0xdebcdf, surfaceHigh: 0x282a2f, onSurface: 0xe2e2e9, outline: 0x44474f },
  green: { primary: 0xb0d18b, primaryContainer: 0x334e17, onPrimaryContainer: 0xcbeda5, secondaryContainer: 0x404a34, onSecondaryContainer: 0xdbe7c8, tertiary: 0xa0cfcc, surfaceHigh: 0x282b24, onSurface: 0xe2e3d8, outline: 0x44483d },
  peach: { primary: 0xffb59e, primaryContainer: 0x723521, onPrimaryContainer: 0xffdbd0, secondaryContainer: 0x5d4037, onSecondaryContainer: 0xffdbd0, tertiary: 0xd7c68d, surfaceHigh: 0x322825, onSurface: 0xf1dfda, outline: 0x53433f },
  lavender: { primary: 0xd3bcfd, primaryContainer: 0x503c74, onPrimaryContainer: 0xebdcff, secondaryContainer: 0x4b4358, onSecondaryContainer: 0xeadef8, tertiary: 0xf1b7c5, surfaceHigh: 0x2c292f, onSurface: 0xe7e0e8, outline: 0x49454e }
}
const C = THEMES[THEME]

// Seconds sweep costs battery; set false to drop it.
const SHOW_SECONDS = true

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const pad = (n) => (n < 10 ? '0' + n : '' + n)
const NORMAL = hmUI.show_level.ONLY_NORMAL
const AOD = hmUI.show_level.ONAL_AOD

// ARC angles are measured from 3 o'clock; this takes clock degrees (0 = 12 o'clock).
const clock = (deg) => deg - 90

// M3 emphasized-decelerate: cubic-bezier(0.05, 0.7, 0.1, 1.0).
function easeEmphasized(t) {
  const bez = (a, b, s) => 3 * a * s * (1 - s) * (1 - s) + 3 * b * s * s * (1 - s) + s * s * s
  let lo = 0, hi = 1, s = t
  for (let i = 0; i < 12; i++) {
    s = (lo + hi) / 2
    if (bez(0.05, 0.1, s) < t) lo = s
    else hi = s
  }
  return bez(0.7, 1, s)
}

function mix(a, b, k) {
  const ch = (shift) => {
    const x = (a >> shift) & 0xff
    const y = (b >> shift) & 0xff
    return Math.round(x + (y - x) * k) << shift
  }
  return ch(16) | ch(8) | ch(0)
}

const ANIM_MS = 450
const FRAME_MS = 33
const SLIDE = 26

function sensor(id, event, onChange) {
  try {
    const s = hmSensor.createSensor(id)
    if (event !== undefined) s.addEventListener(event, onChange)
    return s
  } catch (e) {
    return null
  }
}

function text(o) {
  const box = { x: o.x || 0, y: o.y, w: o.w || 480, h: o.h }
  const widget = hmUI.createWidget(hmUI.widget.TEXT, {
    x: px(box.x), y: px(box.y), w: px(box.w), h: px(box.h),
    text: '', text_size: px(o.size), color: o.color,
    align_h: hmUI.align.CENTER_H, align_v: hmUI.align.CENTER_V,
    show_level: o.level || NORMAL
  })
  return { widget, box, color: o.color }
}

const setText = (t, value) => t.widget.setProperty(hmUI.prop.TEXT, value)

function pill(x, y, w, h, color) {
  const widget = hmUI.createWidget(hmUI.widget.FILL_RECT, {
    x: px(x), y: px(y), w: px(w), h: px(h), radius: px(h / 2), color, show_level: NORMAL
  })
  return { widget, box: { x, y, w, h } }
}

// Invisible hit area that opens the system app for a data type, if the firmware supports it.
function tapTarget(x, y, w, h, typeName) {
  try {
    hmUI.createWidget(hmUI.widget.IMG_CLICK, {
      x: px(x), y: px(y), w: px(w), h: px(h), src: 'tap.png',
      type: hmUI.data_type[typeName], show_level: NORMAL
    })
  } catch (e) {}
}

function complication(cx, cy, color) {
  const r = 44
  hmUI.createWidget(hmUI.widget.CIRCLE, {
    center_x: px(cx), center_y: px(cy), radius: px(r), color: C.surfaceHigh, show_level: NORMAL
  })
  hmUI.createWidget(hmUI.widget.ARC, {
    x: px(cx - r + 5), y: px(cy - r + 5), w: px((r - 5) * 2), h: px((r - 5) * 2),
    start_angle: clock(0), end_angle: clock(360), color: C.outline, line_width: px(6), show_level: NORMAL
  })
  const arc = hmUI.createWidget(hmUI.widget.ARC, {
    x: px(cx - r + 5), y: px(cy - r + 5), w: px((r - 5) * 2), h: px((r - 5) * 2),
    start_angle: clock(0), end_angle: clock(0), color, line_width: px(6), show_level: NORMAL
  })
  const value = text({ x: cx - r, y: cy - 16, w: r * 2, h: 32, size: 22, color: C.onSurface })
  return { arc, value, shown: 0, target: 0 }
}

WatchFace({
  build() {
    hmUI.createWidget(hmUI.widget.FILL_RECT, {
      x: 0, y: 0, w: px(480), h: px(480), color: 0x000000, show_level: NORMAL
    })

    if (SHOW_SECONDS) {
      hmUI.createWidget(hmUI.widget.ARC, {
        x: px(8), y: px(8), w: px(464), h: px(464),
        start_angle: clock(0), end_angle: clock(360), color: C.surfaceHigh, line_width: px(4), show_level: NORMAL
      })
      this.secArc = hmUI.createWidget(hmUI.widget.ARC, {
        x: px(8), y: px(8), w: px(464), h: px(464),
        start_angle: clock(0), end_angle: clock(0), color: C.primary, line_width: px(4), show_level: NORMAL
      })
    }

    this.datePill = pill(176, 50, 128, 44, C.secondaryContainer)
    this.dateText = text({ x: 176, y: 50, w: 128, h: 44, size: 24, color: C.onSecondaryContainer })

    this.hourText = text({ y: 92, h: 150, size: 160, color: C.primary })
    this.minText = text({ y: 226, h: 150, size: 160, color: C.onSurface })

    this.steps = complication(76, 240, C.primary)
    this.battery = complication(404, 240, C.tertiary)

    this.hrPill = pill(166, 382, 148, 44, C.primaryContainer)
    this.hrText = text({ x: 166, y: 382, w: 148, h: 44, size: 24, color: C.onPrimaryContainer })

    tapTarget(32, 196, 88, 88, 'STEP')
    tapTarget(360, 196, 88, 88, 'BATTERY')
    tapTarget(166, 382, 148, 44, 'HEART')

    // Always-on: outlined-tone digits plus the date, everything else off.
    this.aodHour = text({ y: 92, h: 150, size: 160, color: C.outline, level: AOD })
    this.aodMin = text({ y: 226, h: 150, size: 160, color: C.outline, level: AOD })
    this.aodDate = text({ y: 50, h: 44, size: 24, color: C.outline, level: AOD })

    const ev = hmSensor.event
    const refresh = () => this.refreshStats(false)
    this.time = sensor(hmSensor.id.TIME, ev.MINUTEEND, () => this.refreshTime())
    this.stepSensor = sensor(hmSensor.id.STEP, ev.CHANGE, refresh)
    this.batterySensor = sensor(hmSensor.id.BATTERY, ev.CHANGE, refresh)
    this.heart = sensor(hmSensor.id.HEART, ev.LAST, refresh)

    hmUI.createWidget(hmUI.widget.WIDGET_DELEGATE, {
      resume_call: () => this.wake(),
      pause_call: () => this.sleep()
    })

    this.wake()
  },

  wake() {
    this.refreshTime()
    this.refreshStats(true)
    this.startSeconds()
    this.animate(true)
  },

  sleep() {
    this.stopTimer('animTimer')
    this.stopTimer('secTimer')
  },

  refreshTime() {
    const t = this.time
    const hh = pad(t.hour)
    const mm = pad(t.minute)
    const date = DAYS[t.week - 1] + ' ' + t.day
    setText(this.hourText, hh)
    setText(this.minText, mm)
    setText(this.aodHour, hh)
    setText(this.aodMin, mm)
    setText(this.dateText, date)
    setText(this.aodDate, date)
  },

  refreshStats(replay) {
    const val = (s, key) => (s && s[key] > 0 ? s[key] : 0)
    const steps = val(this.stepSensor, 'current')
    const goal = val(this.stepSensor, 'target') || 8000
    const batt = val(this.batterySensor, 'current')
    const hr = val(this.heart, 'last')

    setText(this.steps.value, steps >= 1000 ? (steps / 1000).toFixed(1) + 'k' : '' + steps)
    setText(this.battery.value, batt + '%')
    setText(this.hrText, (hr || '--') + ' bpm')

    this.steps.target = Math.min(steps / goal, 1)
    this.battery.target = Math.min(batt / 100, 1)
    if (replay) {
      this.steps.shown = 0
      this.battery.shown = 0
    } else {
      this.animate(false)
    }
  },

  startSeconds() {
    if (!SHOW_SECONDS) return
    this.stopTimer('secTimer')
    const tick = () => {
      this.secArc.setProperty(hmUI.prop.MORE, { start_angle: clock(0), end_angle: clock(this.time.second * 6) })
    }
    tick()
    this.secTimer = timer.createTimer(1000 - (this.time.utc % 1000), 1000, tick)
  },

  // full=true is the wake entrance: digits slide in and fade up from the outline tone,
  // pills grow from their centre, rings fill. full=false only eases rings to new values.
  animate(full) {
    this.stopTimer('animTimer')
    const rings = [this.steps, this.battery]
    const from = rings.map((r) => r.shown)
    let elapsed = 0

    const slideText = (t, dy, k) => {
      t.widget.setProperty(hmUI.prop.MORE, {
        x: px(t.box.x), y: px(t.box.y + dy * (1 - k)), w: px(t.box.w), h: px(t.box.h),
        color: mix(C.outline, t.color, k)
      })
    }
    const growPill = (p, k) => {
      const w = p.box.w * (0.6 + 0.4 * k)
      p.widget.setProperty(hmUI.prop.MORE, {
        x: px(p.box.x + (p.box.w - w) / 2), y: px(p.box.y), w: px(w), h: px(p.box.h)
      })
    }

    const frame = () => {
      elapsed += FRAME_MS
      const k = easeEmphasized(Math.min(elapsed / ANIM_MS, 1))
      rings.forEach((r, i) => {
        r.shown = from[i] + (r.target - from[i]) * k
        r.arc.setProperty(hmUI.prop.MORE, { start_angle: clock(0), end_angle: clock(360 * r.shown) })
      })
      if (full) {
        slideText(this.hourText, -SLIDE, k)
        slideText(this.minText, SLIDE, k)
        growPill(this.datePill, k)
        growPill(this.hrPill, k)
      }
      if (elapsed >= ANIM_MS) this.stopTimer('animTimer')
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
