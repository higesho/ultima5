/**
 * jfont.ts
 *
 * The Japanese letters' shapes, from the port's own files (public/fonts, made by the fork's tool from the fonts'
 * BDF files): Misaki Gothic 2nd, 8 by 8, for a text cell at the EGA's grain - the PC (1988) look; Shinonome Gothic
 * 16, for a cell of the Modern look (drawn at twice its grain, a cell being 32 by 32 there); and Shinonome Mincho
 * 16, for the Modern look's story pages.
 *
 * Each file: "U5JF", the count (u16), the side (u8), the bytes to a glyph (u8), the letters' codes (u16 each, in
 * order), then the glyphs, row by row from the top, the leftmost pixel the high bit.
 */

export interface JFont {
  side: number;
  /** A letter's rows (side / 8 bytes to a row), or null if the font has none. */
  rows(code: number): Uint8Array | null;
  /** A letter as a mask, one byte to a pixel (nonzero the ink), side by side, or null. */
  mask(code: number): Uint8Array | null;
}

function parse(buf: ArrayBuffer): JFont {
  const d = new DataView(buf);
  const n = d.getUint16(4, true);
  const side = d.getUint8(6);
  const bpg = d.getUint8(7);
  const codes = new Uint16Array(buf.slice(8, 8 + n * 2));
  const base = 8 + n * 2;
  const bytes = new Uint8Array(buf);
  const masks = new Map<number, Uint8Array>();
  const find = (code: number): number => {
    let lo = 0;
    let hi = n - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const c = codes[mid];
      if (c === code) return mid;
      if (c < code) lo = mid + 1;
      else hi = mid - 1;
    }
    return -1;
  };
  const rows = (code: number): Uint8Array | null => {
    const i = find(code);
    return i < 0 ? null : bytes.subarray(base + i * bpg, base + (i + 1) * bpg);
  };
  return {
    side,
    rows,
    mask(code: number): Uint8Array | null {
      let m = masks.get(code);
      if (m) return m;
      const r = rows(code);
      if (!r) return null;
      const stride = side / 8;
      m = new Uint8Array(side * side);
      for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) m[y * side + x] = r[y * stride + (x >> 3)] & (0x80 >> (x & 7)) ? 1 : 0;
      masks.set(code, m);
      return m;
    },
  };
}

/** The fonts, once loaded (loadJFonts); null until then, or where a file could not be had. */
export const jfonts: { small: JFont | null; gothic: JFont | null; mincho: JFont | null } = { small: null, gothic: null, mincho: null };

async function one(name: string): Promise<JFont | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}fonts/${name}`);
    if (!res.ok) return null;
    return parse(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/** Load the three fonts (at the page's start, before the game draws a letter). */
export async function loadJFonts(): Promise<void> {
  const [small, gothic, mincho] = await Promise.all([one('ja-misaki8.bin'), one('ja-shinonome16.bin'), one('ja-shinonome16m.bin')]);
  Object.assign(jfonts, { small, gothic, mincho });
}

/** For the tests and the tools: the fonts from their files' bytes. */
export function useJFonts(small: ArrayBuffer | null, gothic: ArrayBuffer | null, mincho: ArrayBuffer | null): void {
  Object.assign(jfonts, { small: small && parse(small), gothic: gothic && parse(gothic), mincho: mincho && parse(mincho) });
}

/** The 8 by 8 rows of a Japanese letter (the PC look's cell), or a blank where the font has none. */
const BLANK8 = new Uint8Array(8);
export function small8(code: number): Uint8Array {
  return jfonts.small?.rows(code) ?? BLANK8;
}
