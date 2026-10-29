// Mischief Gazette: a newsprint front page. Blackletter weekday masthead, issue strip with the
// day's forecast, large time between temperature columns, full date, and a steps / battery /
// heart row. Footprints cross above the masthead each time the screen wakes.
// All geometry is 466px screen space (Active 2 Round). Images come from make-assets.cjs.

import { ASSETS } from './assets'

const NORMAL = hmUI.show_level.ONLY_NORMAL
const AOD = hmUI.show_level.ONAL_AOD
const CX = 233

// Label positions (VOL., HIGH, LOW, NOW, HUM) are printed on the paper and measured in
// ASSETS.labels; live values start 4px after each label's end.
const LAYOUT = {
  weekY: 54,
  stripY: 131,
  weatherRight: 390,
  labelGap: 4,
  timeY: 168,
  dateY: 290,
  valueY: 356, columns: [135, 233, 331]
}

const WALK_FRAME_MS = 80
const POLL_MS = 30000

const digits = (set) => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => 'g/' + set + '/' + n + '.png')

// Rendered width of a TEXT_IMG string; '.' is the set's separator image.
function textWidth(set, text, sep) {
  let w = 0
  for (const c of text) w += ASSETS.images['g/' + set + '/' + (c === '.' ? sep : c) + '.png'].w
  return w
}
const pad = (n) => (n < 10 ? '0' + n : '' + n)

function image(x, y, src, level) {
  return hmUI.createWidget(hmUI.widget.IMG, { x, y, src, show_level: level || NORMAL })
}

// Image-glyph number. type binds firmware data; otherwise set text yourself.
// sep is the image TEXT_IMG draws for '.', which lets one widget show '7:40' or '5,945'.
function number(o) {
  const opts = {
    x: o.x, y: o.y, w: o.w, h: ASSETS.digits[o.set].h,
    font_array: digits(o.set), h_space: 0,
    align_h: o.align || hmUI.align.CENTER_H,
    negative_image: 'g/' + o.set + '/minus.png',
    show_level: o.level || NORMAL
  }
  if (o.sep) opts.dot_image = 'g/' + o.set + '/' + o.sep + '.png'
  if (o.unit) {
    const u = 'g/' + o.set + '/' + o.unit + '.png'
    Object.assign(opts, { unit_en: u, unit_sc: u, unit_tc: u, imperial_unit_en: u, imperial_unit_sc: u, imperial_unit_tc: u })
  }
  if (o.invalid) opts.invalid_image = o.invalid
  if (o.type !== undefined) opts.type = o.type
  else opts.text = o.text || '0'
  return hmUI.createWidget(hmUI.widget.TEXT_IMG, opts)
}

function sensor(id, event, cb) {
  try {
    const s = hmSensor.createSensor(id)
    if (event !== undefined) s.addEventListener(event, cb)
    return s
  } catch (e) {
    return null
  }
}

// ISO-8601 week number: the paper's issue number is the week of the year.
function isoWeek(year, month, day) {
  const d = new Date(Date.UTC(year, month - 1, day))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const start = Date.UTC(d.getUTCFullYear(), 0, 1)
  return Math.ceil(((d - start) / 86400000 + 1) / 7)
}

// Steps with thousands separators, written with '.' because TEXT_IMG maps '.' to its comma image.
function groupThousands(n) {
  let s = '' + Math.max(0, Math.floor(n))
  let out = ''
  while (s.length > 3) {
    out = '.' + s.slice(-3) + out
    s = s.slice(0, -3)
  }
  return s + out
}

WatchFace({
  build() {
    const L = hmUI.align
    const D = hmUI.data_type

    image(0, 0, 'paper.png')

    this.week = image(CX - 160, LAYOUT.weekY, 'week/0.png')
    const after = (key) => ASSETS.labels[key].end + LAYOUT.labelGap
    this.issue = number({ x: after('vol'), y: LAYOUT.stripY - 1, w: 40, set: 'issue', align: L.LEFT })
    this.weatherLine = image(LAYOUT.weatherRight - 150, LAYOUT.stripY, 'weather/25.png')

    const small = (key, type, unit) => number({ x: after(key), y: ASSETS.labels[key].y - 3, w: 56, set: 'small', align: L.LEFT, type, unit })
    small('high', D.WEATHER_HIGH, 'deg')
    small('low', D.WEATHER_LOW, 'deg')
    small('now', D.WEATHER_CURRENT, 'deg')
    small('hum', D.HUMIDITY, 'pct')

    // Box is wider than the widest reading: TEXT_IMG clips glyphs that touch its edge.
    this.time = number({ x: CX - 150, y: LAYOUT.timeY, w: 300, set: 'time', sep: 'colon' })

    const [c1, c2, c3] = LAYOUT.columns
    this.steps = number({ x: c1 - 48, y: LAYOUT.valueY, w: 96, set: 'value', sep: 'comma' })
    number({ x: c2 - 46, y: LAYOUT.valueY, w: 92, set: 'value', type: D.BATTERY })
    number({ x: c3 - 46, y: LAYOUT.valueY, w: 92, set: 'value', type: D.HEART, invalid: 'dash.png' })

    // Always-on: muted weekday and time on black, no paper.
    this.weekAod = image(CX - 160, LAYOUT.weekY + 40, 'weekAod/0.png', AOD)
    // IMG_TIME is firmware-driven, so AOD time keeps updating with no script running.
    const tw = ASSETS.digits.timeAod.w
    const colonW = ASSETS.images['g/timeAod/colon.png'].w
    hmUI.createWidget(hmUI.widget.IMG_TIME, {
      hour_startX: CX - colonW / 2 - 2 * tw, hour_startY: LAYOUT.timeY, hour_zero: 1, hour_space: 0, hour_array: digits('timeAod'), hour_align: L.LEFT,
      minute_startX: CX + colonW / 2, minute_startY: LAYOUT.timeY, minute_zero: 1, minute_space: 0, minute_array: digits('timeAod'), minute_align: L.LEFT,
      minute_follow: 0, show_level: AOD
    })
    image(CX - colonW / 2, LAYOUT.timeY, 'g/timeAod/colon.png', AOD)

    const W = ASSETS.walk
    this.walk = image(W.x, W.y, 'walk/' + (W.frames - 1) + '.png')

    const ev = hmSensor.event
    this.clock = sensor(hmSensor.id.TIME, ev.MINUTEEND, () => this.refreshTime())
    this.stepSensor = sensor(hmSensor.id.STEP, ev.CHANGE, () => this.refreshSteps())
    this.weather = sensor(hmSensor.id.WEATHER)

    hmUI.createWidget(hmUI.widget.WIDGET_DELEGATE, {
      resume_call: () => this.wake(),
      pause_call: () => this.sleep()
    })

    this.wake()
  },

  wake() {
    this.sleep()
    this.refreshTime()
    this.refreshSteps()
    this.refreshWeather()
    this.pollTimer = timer.createTimer(POLL_MS, POLL_MS, () => this.refreshSteps())
    this.playWalk()
  },

  sleep() {
    this.stopTimer('walkTimer')
    this.stopTimer('pollTimer')
    if (this.walk) this.walk.setProperty(hmUI.prop.SRC, 'walk/' + (ASSETS.walk.frames - 1) + '.png')
  },

  refreshTime() {
    const t = this.clock
    // format_hour follows the watch's 12/24-hour setting; fall back to the 24-hour value.
    const hour = typeof t.format_hour === 'number' ? t.format_hour : t.hour
    this.time.setProperty(hmUI.prop.TEXT, hour + '.' + pad(t.minute))

    const key = t.year * 10000 + t.month * 100 + t.day
    if (key === this.dateKey) return
    this.dateKey = key
    this.week.setProperty(hmUI.prop.SRC, 'week/' + (t.week - 1) + '.png')
    this.weekAod.setProperty(hmUI.prop.SRC, 'weekAod/' + (t.week - 1) + '.png')
    this.issue.setProperty(hmUI.prop.TEXT, '' + isoWeek(t.year, t.month, t.day))
    this.placeDate(t)
  },

  // Month name + "24, 2026". The pair is centred as a unit, so it is rebuilt once a day at the
  // right x instead of moving widgets with partial property updates.
  placeDate(t) {
    if (this.dateWidgets) this.dateWidgets.forEach((w) => hmUI.deleteWidget(w))
    const month = 'month/' + (t.month - 1) + '.png'
    const text = t.day + '.' + t.year
    const numW = textWidth('date', text, 'sep')
    const monthW = ASSETS.images[month].w
    const x = Math.round(CX - (monthW + numW) / 2)
    this.dateWidgets = [
      image(x, LAYOUT.dateY, month),
      number({ x: x + monthW, y: LAYOUT.dateY, w: numW + 16, set: 'date', sep: 'sep', align: hmUI.align.LEFT, text })
    ]
  },

  refreshSteps() {
    const s = this.stepSensor
    this.steps.setProperty(hmUI.prop.TEXT, groupThousands(s && s.current > 0 ? s.current : 0))
  },

  refreshWeather() {
    let index = 25
    try {
      const today = this.weather.getForecastWeather().forecastData.data[0]
      if (today && today.index >= 0 && today.index <= 28) index = Math.floor(today.index)
    } catch (e) {}
    this.weatherLine.setProperty(hmUI.prop.SRC, 'weather/' + index + '.png')
  },

  playWalk() {
    const W = ASSETS.walk
    let frame = 0
    this.walk.setProperty(hmUI.prop.SRC, 'walk/0.png')
    this.walkTimer = timer.createTimer(WALK_FRAME_MS, WALK_FRAME_MS, () => {
      frame++
      this.walk.setProperty(hmUI.prop.SRC, 'walk/' + frame + '.png')
      if (frame >= W.frames - 1) this.stopTimer('walkTimer')
    })
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
