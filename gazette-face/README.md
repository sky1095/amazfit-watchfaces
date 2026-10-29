# Mischief Gazette

Newspaper front-page watchface for Amazfit Active 2 Round (466 × 466): blackletter weekday masthead,
issue strip with the day's forecast, large serif time between temperature columns, full date, and a
steps / battery / heart row. Footprints cross above the masthead for about two seconds on each wake.

Readings: forecast condition, high/low and current temperature, humidity, battery and heart rate are
bound to firmware data types. Steps come from the step sensor so they can be shown with a thousands
separator. VOL. is the ISO week number. HUM is humidity (Zepp exposes no rain-probability value).

Always-on mode shows the weekday and firmware-driven time on black; no script runs in AOD.

```sh
node make-assets.cjs   # renders every image into assets/default and writes watchface/assets.js
node check.cjs         # runs the face in a mocked Zepp runtime and renders preview*.png
../zeus-tools/g/bin/zeus preview -t 'Amazfit Active 2 (Round)'
```

Fonts (all SIL Open Font License, licences in fonts/): Unifraktur Maguntia, DM Serif Display,
Old Standard TT. The watch receives raster glyphs, not font files.
