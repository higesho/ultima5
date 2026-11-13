/**
 * gameText.ts
 *
 * The game's own text in Japanese (the fork's), where the engine reads it from the player's files: the translation
 * of each string, keyed by where the English is (made by the fork's tool from the translation's tables). Nothing of
 * the game is here but the translation: the English stays in the player's files, and is read as ever where
 * Japanese is not shown, or where a string has none (a word the game listens for: a keyword, a mantra, a name).
 */

import { ja } from './i18n.ts';
import ovl from './ja/ovl.json';
import tlk from './ja/tlk.json';
import dat from './ja/dat.json';

const OVL = ovl as Record<string, string>;
const TLK = tlk as Record<string, string[]>;
const DAT = dat as Record<string, Record<string, unknown>>;

/** A DATA.OVL string's Japanese, by its data-segment address; undefined where English is shown or it has none. */
export function ovlText(address: number): string | undefined {
  return ja() ? OVL[address.toString(16)] : undefined;
}

/**
 * A townsman's script in Japanese: number `index` of TLK file `file` (in the order of the file's index), as the
 * engine walks a script - each element what the byte of the English would be (its strings, keywords, actions and
 * letters with bit 7 set), but a Japanese letter, which is its own character code (0x100 and over). Null where
 * English is shown or there is none.
 */
export function tlkScript(file: string, index: number): Uint16Array | null {
  if (!ja()) return null;
  const s = TLK[file.toUpperCase()]?.[index];
  if (s === undefined) return null;
  const out = new Uint16Array(Math.max(0x400, s.length + 0x10));
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** A string of one of the game's other text files (SHOPPE.DAT, LOOK2.DAT, STORY.DAT...) by its offset, in Japanese. */
export function datText(file: string, offset: number): string | undefined {
  if (!ja()) return undefined;
  const v = DAT[file.toUpperCase()]?.[String(offset)];
  return typeof v === 'string' ? v : undefined;
}

/**
 * A sign's runs of plain letters in Japanese (SIGNS.DAT), by the offset of its record's head: each [start, end, text],
 * start and end within the sign's text (after its four bytes of head), its runes and frame as they are.
 */
export function signRuns(offset: number): [number, number, string][] | undefined {
  if (!ja()) return undefined;
  const v = DAT['SIGNS.DAT']?.[String(offset)];
  return Array.isArray(v) ? (v as [number, number, string][]) : undefined;
}
