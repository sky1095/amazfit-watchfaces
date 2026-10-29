import { argbFromHex, hexFromArgb, Hct, SchemeTonalSpot } from '@material/material-color-utilities'
const seed = process.argv[2] || '#6750A4'
const s = new SchemeTonalSpot(Hct.fromInt(argbFromHex(seed)), true, 0)
const keys = ['primary','onPrimary','primaryContainer','onPrimaryContainer','secondary','secondaryContainer','onSecondaryContainer','tertiary','tertiaryContainer','onTertiaryContainer','surfaceContainer','surfaceContainerHigh','onSurface','onSurfaceVariant','outlineVariant']
for (const k of keys) console.log(k.padEnd(22), hexFromArgb(s[k]))
