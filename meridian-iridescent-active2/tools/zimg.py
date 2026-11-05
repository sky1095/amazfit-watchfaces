import struct
from PIL import Image
def decode(data, order='BGRA', o16='565le'):
    idlen, cmtype, itype = data[0], data[1], data[2]
    cmfirst, cmlen, cmbits = struct.unpack('<HHB', data[3:8])
    sw, sh, bpp, desc = struct.unpack('<HHBB', data[12:18])
    idf = data[18:18+idlen]
    rw = struct.unpack('<H', idf[4:6])[0]
    p = 18+idlen
    if itype == 1:
        pal = []
        for i in range(cmlen):
            e = data[p+4*i:p+4*i+4]
            d = dict(zip(order, e)); pal.append((d['R'], d['G'], d['B'], d['A']))
        p += 4*cmlen
        px = data[p:p+sw*sh]
        im = Image.new('RGBA', (rw, sh))
        im.putdata([pal[px[y*sw+x]] for y in range(sh) for x in range(rw)])
    elif itype == 2 and bpp == 16:
        im = Image.new('RGBA', (rw, sh)); out = []
        for y in range(sh):
            for x in range(rw):
                v = struct.unpack('<H', data[p+2*(y*sw+x):p+2*(y*sw+x)+2])[0]
                if o16 == '565be': v = ((v & 0xff) << 8) | (v >> 8)
                r = (v >> 11) & 31; g = (v >> 5) & 63; b = v & 31
                out.append((r*255//31, g*255//63, b*255//31, 255))
        im.putdata(out)
    else:
        raise ValueError('type %d bpp %d' % (itype, bpp))
    if not (desc & 0x20): im = im.transpose(Image.FLIP_TOP_BOTTOM)
    return im


def quantize(im):
    """255-colour palette. Grey+alpha art is quantised in (grey, alpha) space."""
    px = list(im.getdata())
    uniq = set(px)
    if len(uniq) <= 255:
        pal = sorted(uniq)
        idx = {c: i for i, c in enumerate(pal)}
        q = Image.new('P', im.size); q.putdata([idx[c] for c in px])
        return q, [v for c in pal for v in c]
    if all(max(r, g, b) - min(r, g, b) <= 12 or a < 64 for r, g, b, a in uniq):
        proxy = Image.new('RGB', im.size)
        proxy.putdata([((r + g + b) // 3 if a else 0, a, 0) for r, g, b, a in px])
        q = proxy.quantize(colors=255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        p3 = q.getpalette()[:255 * 3]
        pal = []
        for i in range(len(p3) // 3):
            g, a = p3[3 * i], p3[3 * i + 1]
            pal += [g, g, g, a]
        return q, pal
    q = im.quantize(colors=255, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    return q, (q.getpalette(rawmode='RGBA') or [])


def encode(im, orig, order='BGRA', o16='565le'):
    """Encode RGBA `im` in the same TGA flavour as the original file bytes `orig`."""
    idlen, itype = orig[0], orig[2]
    bpp, desc = orig[16], orig[17]
    assert desc & 0x20
    w, h = im.size
    sw = (w + 15) // 16 * 16
    head = bytearray(orig[:18 + idlen])
    head[12:16] = struct.pack('<HH', sw, h)
    head[22:24] = struct.pack('<H', w)
    if itype == 1:
        q, pal = quantize(im)
        pal = pal + [0] * (1024 - len(pal))
        pal[255 * 4:256 * 4] = [0, 0, 0, 0]
        cm = bytearray()
        for i in range(256):
            r, g, b, a = pal[4 * i:4 * i + 4]
            d = {'R': r, 'G': g, 'B': b, 'A': a}
            cm += bytes(d[c] for c in order)
        src = q.tobytes()
        px = bytearray([255]) * (sw * h)
        for y in range(h):
            px[y * sw:y * sw + w] = src[y * w:(y + 1) * w]
        return bytes(head) + bytes(cm) + bytes(px)
    if itype == 2 and bpp == 16:
        out = bytearray(sw * h * 2)
        rgb = im.convert('RGB').load()
        for y in range(h):
            for x in range(w):
                r, g, b = rgb[x, y]
                v = ((r * 31 + 127) // 255) << 11 | ((g * 63 + 127) // 255) << 5 | ((b * 31 + 127) // 255)
                if o16 == '565be':
                    v = ((v & 0xff) << 8) | (v >> 8)
                out[2 * (y * sw + x):2 * (y * sw + x) + 2] = struct.pack('<H', v)
        return bytes(head) + bytes(out)
    raise ValueError('unsupported image type')
