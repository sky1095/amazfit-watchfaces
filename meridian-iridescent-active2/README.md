# Meridian Iridescent — Active 2 (Round)

Separate 466 × 466 edition of Meridian by aditya3524, based on `../meridian-active2`.
The original hands and editable complications are retained in the active face.

## Minimal AOD (v1.2.0)

Pure black dial, twelve sparse hour markers (double strokes at the quarter hours),
four faint inner-track arcs and white outlined hour/minute hands. The hands retain
Meridian's original size, shape and rotation centres to avoid jumping on wake.
No seconds, complications, iridescence, sensor access or JavaScript timers are
created in AOD; the native `TIME_POINTER` widget displays the time.

The generated artwork's illuminated-pixel upper bound is 1.15% of the circular
display, including both hands and hub before overlap. It is a design measurement,
not a battery-life measurement. Rotation rasterization may slightly change coverage.
Check AOD legibility, time progression and wake transitions on the watch.
Rebuild assets with `python tools/make_aod.py` (Pillow).

The dial tracks and numerals have a metallic interference finish. Tilting the watch
changes its colour and reflection using the accelerometer's gravity vector. The
base finish also shifts with the watch's local time, interpolating between morning
(06:00), afternoon (12:00), evening (18:00) and night (22:00), wrapping smoothly
through midnight. These are fixed clock times, not calculated sunrise or sunset.
Time and tilt offsets combine; hold the watch at the same angle to compare periods.
This
simulates reflected light; the screen cannot measure the viewer's angle or real lighting.

Sensor samples are smoothed over 180 ms, with redraws limited to one per 80 ms and
32 pre-rendered phases. No sensor or animation runs for this effect in AOD. The
sensor is stopped on pause and destruction. If sensor access fails, the dial still
changes with local time and logs the sensor failure. Hardware support in the watchface
runtime needs verification on an Active 2; a successful build alone cannot confirm it.
Battery impact has not been measured.

## Build and check

`node check.cjs`

`npx --yes --package=@zeppos/zeus-cli zeus build`

Zeus 1.9.3 currently fails to resolve its bundled `zeppos-app-utils` in a plain
installation here. The successful build used its own `private-modules` directory
on `NODE_PATH`. For a global CLI installation the equivalent is:

```sh
npm install -g @zeppos/zeus-cli@1.9.3
NODE_PATH="$(npm root -g)/@zeppos/zeus-cli/private-modules" zeus build
```

The install package is generated in `dist/`. Install through your existing Zepp
developer workflow or a compatible third-party `.zab` installer. This edition has
its own app ID (1131112) so it can coexist with Meridian.

To regenerate the committed dial phases, install Pillow in a Python environment
and run `python tools/make_iridescence.py` from this folder.

On-watch acceptance: tilt left/right and toward/away from you, hold still to check
for jitter, enter and leave AOD, switch faces and return, and edit each complication.
Confirm the colours follow movement and resume after waking. If colours remain
unchanged during movement, inspect the `MERIDIAN widget failed: iridescence` log for sensor rejection.
To check time-based colour, keep the watch at one angle and compare 06:00, 12:00,
18:00 and 22:00, then check the midnight transition. Version 1.2.0 adds minimal AOD;
use the latest preview QR, since earlier QRs install their earlier uploaded builds.

Design: retain Meridian's typography and hierarchy; restrict the new colour
treatment to the dial plane. Keep the surface dark and the hands and data bright.
Iridescent colour variation is the requested material effect. Motion follows wrist
position only. ENERGY 2 / RHYTHM 1 / MOTION 2.
