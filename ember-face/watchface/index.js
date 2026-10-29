// Ember: digital time, date, heart rate, with step (left) and battery (right) arcs.
// Layout is drawn on a 480px design grid; px() scales it to the device screen.

const C = {
  bg: 0x000000,
  ember: 0xff6a2b,
  battery: 0x4fd1a5,
  track: 0x262626,
  text: 0xffffff,
  dim: 0x8a8a8a
}

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

// ARC angles start at 3 o'clock and run clockwise; both arcs grow upward from the bottom.
const STEP_ARC = { start: 125, end: 235 }
const BATT_ARC = { start: 55, end: -55 }

const pad = (n) => (n < 10 ? '0' + n : '' + n)

WatchFace({
  build() {
    const normal = hmUI.show_level.ONLY_NORMAL

    hmUI.createWidget(hmUI.widget.FILL_RECT, {
      x: 0, y: 0, w: px(480), h: px(480), color: C.bg, show_level: normal
    })

    const arc = (range, color, level) =>
      hmUI.createWidget(hmUI.widget.ARC, {
        x: px(20), y: px(20), w: px(440), h: px(440),
        start_angle: range.start, end_angle: range.end,
        color, line_width: px(14), show_level: level
      })

    arc(STEP_ARC, C.track, normal)
    arc(BATT_ARC, C.track, normal)
    this.stepArc = arc(STEP_ARC, C.ember, normal)
    this.battArc = arc(BATT_ARC, C.battery, normal)

    const text = (y, h, size, color, level) =>
      hmUI.createWidget(hmUI.widget.TEXT, {
        x: 0, y: px(y), w: px(480), h: px(h),
        text: '', text_size: px(size), color,
        align_h: hmUI.align.CENTER_H, align_v: hmUI.align.CENTER_V,
        show_level: level
      })

    this.dateText = text(110, 40, 30, C.ember, normal)
    this.timeText = text(160, 140, 128, C.text, normal)
    this.hrText = text(305, 40, 30, C.text, normal)
    this.stepText = text(355, 34, 24, C.dim, normal)

    // Always-on display: time only, dim, to save power.
    this.aodTime = text(170, 140, 120, C.dim, hmUI.show_level.ONAL_AOD)

    this.time = hmSensor.createSensor(hmSensor.id.TIME)
    this.step = hmSensor.createSensor(hmSensor.id.STEP)
    this.battery = hmSensor.createSensor(hmSensor.id.BATTERY)
    this.heart = hmSensor.createSensor(hmSensor.id.HEART)

    this.time.addEventListener(hmSensor.event.MINUTEEND, () => this.refreshTime())
    this.step.addEventListener(hmSensor.event.CHANGE, () => this.refreshStats())
    this.battery.addEventListener(hmSensor.event.CHANGE, () => this.refreshStats())
    this.heart.addEventListener(hmSensor.event.LAST, () => this.refreshStats())

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
    const hhmm = pad(t.hour) + ':' + pad(t.minute)
    this.timeText.setProperty(hmUI.prop.TEXT, hhmm)
    this.aodTime.setProperty(hmUI.prop.TEXT, hhmm)
    this.dateText.setProperty(
      hmUI.prop.TEXT,
      DAYS[t.week - 1] + '  ' + t.day + ' ' + MONTHS[t.month - 1]
    )
  },

  refreshStats() {
    const steps = this.step.current || 0
    const goal = this.step.target || 8000
    const stepRatio = Math.min(steps / goal, 1)
    const battRatio = Math.min((this.battery.current || 0) / 100, 1)

    this.stepArc.setProperty(hmUI.prop.MORE, {
      end_angle: STEP_ARC.start + (STEP_ARC.end - STEP_ARC.start) * stepRatio
    })
    this.battArc.setProperty(hmUI.prop.MORE, {
      end_angle: BATT_ARC.start + (BATT_ARC.end - BATT_ARC.start) * battRatio
    })

    const hr = this.heart.last
    this.hrText.setProperty(hmUI.prop.TEXT, '♥ ' + (hr > 0 ? hr : '--') + ' BPM')
    this.stepText.setProperty(
      hmUI.prop.TEXT,
      steps + ' STEPS  ·  ' + (this.battery.current || 0) + '%'
    )
  },

  onDestroy() {}
})
