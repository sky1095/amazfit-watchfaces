# Ember: Zepp OS watch face

A digital face for round Amazfit watches running Zepp OS (GTR 4, GTR Mini, Balance, Active, Cheetah, T-Rex 2/3 and others).
It shows the time, date, heart rate and steps, with a step-goal arc on the left and a battery arc on the right.
In always-on mode it shows only the time, dimmed.

## Install on your watch

1. `npm i @zeppos/zeus-cli -g` (or use the copy already in `../zeus-tools/g/bin/zeus`)
2. In the Zepp phone app, turn on Developer Mode: Profile → Settings → About, then tap the Zepp icon 7 times.
3. In this folder, run `zeus login`, then `zeus preview`. Choose your watch model when asked.
4. In the Zepp app, open Profile → Developer Mode and scan the QR code. The face installs on your watch.

To try it on a computer first, install Zepp Simulator and run `zeus dev`.

## Customize

Colors live in the `C` object at the top of `watchface/index.js`.
