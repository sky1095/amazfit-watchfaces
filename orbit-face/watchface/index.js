// Orbit: 60-tick minute ring, split-color time, weather + distance, three activity
// gauges (steps, calories, stand) and a health row. Drawn on a 480px design grid.

const C = {
  bg: 0x000000,
  hour: 0xffffff,
  minute: 0x00e5ff,
  tickOn: 0x00e5ff,
  tickNow: 0xffffff,
  tickOff: 0x1c2629,
  tickHour: 0x3b4d52,
  dim: 0x8a9499,
  steps: 0xff7a2f,
  kcal: 0xff3d7f,
  stand: 0xb6ff3b,
  track: 0x1f1f1f
}

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

// ARC angles are measured from 3 o'clock; this takes clock degrees (0 = 12 o'clock).
const clock = (deg) => deg - 90
const pad = (n) => (n < 10 ? '0' + n : '' + n)
const NORMAL = hmUI.show_level.ONLY_NORMAL

// Some sensors are missing on some models; a missing one should blank its field, not crash the face.
function sensor(id, event, onChange) {
  try {
    const s = hmSensor.createSensor(id)
    if (event !== undefined) s.addEventListener(event, onChange)
    return s
  } catch (e) {
    return null
  }
}

function text(opts) {
  return hmUI.createWidget(hmUI.widget.TEXT, {
    x: px(opts.x || 0), y: px(opts.y), w: px(opts.w || 480), h: px(opts.h),
    text: '', text_size: px(opts.size), color: opts.color,
    align_h: opts.align || hmUI.align.CENTER_H, align_v: hmUI.align.CENTER_V,
    show_level: opts.level || NORMAL
  })
}

function ring(cx, cy, r, color, from, to, width) {
  return hmUI.createWidget(hmUI.widget.ARC, {
    x: px(cx - r), y: px(cy - r), w: px(r * 2), h: px(r * 2),
    start_angle: clock(from), end_angle: clock(to),
    color, line_width: px(width), show_level: NORMAL
  })
}

const GAUGE_R = 38
const GAUGE_Y = 318
const GAUGES = [
  { key: 'steps', x: 146, color: C.steps, label: 'STEPS' },
  { key: 'kcal', x: 240, color: C.kcal, label: 'KCAL' },
  { key: 'stand', x: 334, color: C.stand, label: 'STAND' }
]

WatchFace({
  build() {
    hmUI.createWidget(hmUI.widget.FILL_RECT, {
      x: 0, y: 0, w: px(480), h: px(480), color: C.bg, show_level: NORMAL
    })

    this.ticks = []
    for (let i = 0; i < 60; i++) {
      this.ticks.push(ring(240, 240, 226, C.tickOff, i * 6 - 1.6, i * 6 + 1.6, 12))
    }

    this.dateText = text({ y: 70, h: 34, size: 26, color: C.dim })
    this.infoText = text({ y: 104, h: 30, size: 22, color: C.minute })

    this.hourText = text({ x: 0, y: 132, w: 226, h: 130, size: 124, color: C.hour, align: hmUI.align.RIGHT })
    text({ x: 226, y: 126, w: 28, h: 130, size: 110, color: C.dim }).setProperty(hmUI.prop.TEXT, ':')
    this.minText = text({ x: 254, y: 132, w: 226, h: 130, size: 124, color: C.minute, align: hmUI.align.LEFT })

    this.gauges = {}
    for (const g of GAUGES) {
      ring(g.x, GAUGE_Y, GAUGE_R, C.track, 0, 360, 8)
      this.gauges[g.key] = {
        arc: ring(g.x, GAUGE_Y, GAUGE_R, g.color, 0, 0, 8),
        value: text({ x: g.x - 40, y: GAUGE_Y - 14, w: 80, h: 28, size: 20, color: C.hour })
      }
      text({ x: g.x - 45, y: GAUGE_Y + GAUGE_R + 4, w: 90, h: 22, size: 15, color: g.color })
        .setProperty(hmUI.prop.TEXT, g.label)
    }

    this.healthText = text({ y: 388, h: 30, size: 21, color: C.hour })

    // Always-on: time and date only, no rings, to keep pixels mostly off.
    this.aodTime = text({ y: 150, h: 130, size: 120, color: C.dim, level: hmUI.show_level.ONAL_AOD })
    this.aodDate = text({ y: 290, h: 34, size: 26, color: 0x555555, level: hmUI.show_level.ONAL_AOD })

    const refresh = () => this.refreshStats()
    const ev = hmSensor.event
    this.time = sensor(hmSensor.id.TIME, ev.MINUTEEND, () => this.refreshTime())
    this.step = sensor(hmSensor.id.STEP, ev.CHANGE, refresh)
    this.calorie = sensor(hmSensor.id.CALORIE, ev.CHANGE, refresh)
    this.stand = sensor(hmSensor.id.STAND, ev.CHANGE, refresh)
    this.distance = sensor(hmSensor.id.DISTANCE, ev.CHANGE, refresh)
    this.battery = sensor(hmSensor.id.BATTERY, ev.CHANGE, refresh)
    this.heart = sensor(hmSensor.id.HEART, ev.LAST, refresh)
    this.spo2 = sensor(hmSensor.id.SPO2, ev.CHANGE, refresh)
    this.weather = sensor(hmSensor.id.WEATHER)

    hmUI.createWidget(hmUI.widget.WIDGET_DELEGATE, {
      resume_call: () => {
        this.refreshTime()
        this.refreshStats()
      }
    })

    this.refreshTime()
    this.refreshStats()
  },

  refreshTime() {
    const t = this.time
    const hh = pad(t.hour)
    const mm = pad(t.minute)
    const date = DAYS[t.week - 1] + '  ' + t.day + ' ' + MONTHS[t.month - 1]

    this.hourText.setProperty(hmUI.prop.TEXT, hh)
    this.minText.setProperty(hmUI.prop.TEXT, mm)
    this.dateText.setProperty(hmUI.prop.TEXT, date)
    this.aodTime.setProperty(hmUI.prop.TEXT, hh + ':' + mm)
    this.aodDate.setProperty(hmUI.prop.TEXT, date)

    for (let i = 0; i < 60; i++) {
      let color = i % 5 === 0 ? C.tickHour : C.tickOff
      if (i < t.minute) color = C.tickOn
      if (i === t.minute) color = C.tickNow
      this.ticks[i].setProperty(hmUI.prop.MORE, { color })
    }

    this.refreshWeather()
  },

  refreshWeather() {
    this.weatherLine = ''
    try {
      const today = this.weather.getForecastWeather().forecastData.data[0]
      this.weatherLine = today.high + '°/' + today.low + '°'
    } catch (e) {}
  },

  refreshStats() {
    const val = (s, key) => (s && s[key] > 0 ? s[key] : 0)

    const fill = (key, current, target) => {
      const g = this.gauges[key]
      const ratio = target > 0 ? Math.min(current / target, 1) : 0
      g.arc.setProperty(hmUI.prop.MORE, { start_angle: clock(0), end_angle: clock(360 * ratio) })
      g.value.setProperty(hmUI.prop.TEXT, current >= 10000 ? (current / 1000).toFixed(1) + 'k' : '' + current)
    }

    fill('steps', val(this.step, 'current'), val(this.step, 'target') || 8000)
    fill('kcal', val(this.calorie, 'current'), val(this.calorie, 'target') || 400)
    fill('stand', val(this.stand, 'current'), val(this.stand, 'target') || 12)

    const km = (val(this.distance, 'current') / 1000).toFixed(1) + ' KM'
    this.infoText.setProperty(hmUI.prop.TEXT, this.weatherLine ? this.weatherLine + '   ' + km : km)

    const hr = val(this.heart, 'last')
    const o2 = val(this.spo2, 'current')
    this.healthText.setProperty(
      hmUI.prop.TEXT,
      'HR ' + (hr || '--') + '   O2 ' + (o2 ? o2 + '%' : '--') + '   ' + val(this.battery, 'current') + '%'
    )
  },

  onDestroy() {}
})
