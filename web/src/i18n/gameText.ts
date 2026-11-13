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
import kw from './ja/kw.json';

const OVL = ovl as Record<string, string>;
const TLK = tlk as Record<string, Record<string, Record<string, string>>>;
const DAT = dat as Record<string, Record<string, unknown>>;

/** A DATA.OVL string's Japanese, by its data-segment address; undefined where English is shown or it has none. */
export function ovlText(address: number): string | undefined {
  return ja() ? OVL[address.toString(16)] : undefined;
}

/**
 * A townsman's script in Japanese, built from their English script in the player's file (`english`: number `index`
 * of TLK file `file`, in the order of the file's index, to where the next begins) and the translation of its strings
 * (tlk.json: only the translation - the game's script is the player's). Each element is what the byte of the English
 * would be (its strings, keywords, actions and letters with bit 7 set), but a Japanese letter, which is its own
 * character code (0x100 and over); the strings without a translation (keywords, the answers a question listens for)
 * are the English as it is. Null where English is shown or there is none.
 */
export function tlkScript(file: string, index: number, english: Uint8Array): Uint16Array | null {
  if (!ja()) return null;
  const tr = TLK[file.toUpperCase()]?.[String(index)];
  if (tr === undefined) return null;
  const fields: number[][] = [[]];
  for (const b of english) {
    if (b === 0) fields.push([]);
    else fields[fields.length - 1].push(b);
  }
  const built = fields.map((f, i) => (tr[String(i)] !== undefined ? repair(encodeField(tr[String(i)]), f) : f));
  fixScriptFields(fields, built);
  const codes = built.flatMap((f, i) => (i ? [0, ...f] : f));
  const out = new Uint16Array(Math.max(0x400, codes.length + 0x10));
  out.set(codes);
  return out;
}

/** A translated string as a script's: "\n" a line's end (0x8d), "{xx}" an action's byte, a letter with bit 7 set. */
function encodeField(text: string): number[] {
  const out: number[] = [];
  for (const part of text.split(/(\{[0-9a-fA-F]{2}\}|\n)/)) {
    if (!part) continue;
    if (part === '\n') out.push(0x8d);
    else if (/^\{[0-9a-fA-F]{2}\}$/.test(part)) out.push(parseInt(part.slice(1, 3), 16));
    else
      for (const ch of part) {
        const c = ch.charCodeAt(0);
        out.push(c < 0x80 ? c | 0x80 : c);
      }
  }
  return out;
}

/** The actions that take arguments, and how many. */
const ARGS: Record<number, number> = { 0xfe: 2, 0x85: 3, 0x86: 1, 0x8c: 1 };

/**
 * A translated string's actions as the English string `en` has them: each action's arguments the English's, right
 * after it (a translation that moved one into its words has it back); 0xff ("Your interest?") where the
 * translation's tables wrote it as 0xc0; and no word of the dictionary (0x01-0x80) left in it, which would be said in
 * English.
 */
function repair(ja: number[], en: number[]): number[] {
  ja = [...ja];
  const count = (a: number[], v: number): number => a.filter((x) => x === v).length;
  if (count(ja, 0xff) < count(en, 0xff)) {
    let extra = count(ja, 0xc0) - count(en, 0xc0);
    let need = count(en, 0xff) - count(ja, 0xff);
    for (let j = 0; j < ja.length && extra > 0 && need > 0; j++)
      if (ja[j] === 0xc0) {
        ja[j] = 0xff;
        extra--;
        need--;
      }
  }
  const want: [number, number[]][] = [];
  for (let i = 0; i < en.length; ) {
    const n = ARGS[en[i]];
    if (n !== undefined) {
      want.push([en[i], en.slice(i + 1, i + 1 + n)]);
      i += 1 + n;
    } else i++;
  }
  const out: number[] = [];
  let w = 0;
  for (let i = 0; i < ja.length; ) {
    const c = ja[i];
    if (ARGS[c] !== undefined && w < want.length && want[w][0] === c) {
      const args = want[w][1];
      const got = ja.slice(i + 1, i + 1 + args.length);
      out.push(c, ...args);
      i += 1 + args.length;
      if (got.join() !== args.join()) {
        // What was read for an argument that is the translation's words goes back; the argument set apart is dropped.
        const keep = got.filter((g) => g >= 0x100 || ((g & 0x7f) >= 0x20 && g >= 0xa0 && !args.includes(g)));
        const rest = ja.slice(i);
        for (const a of args) {
          const at = rest.indexOf(a);
          if (at >= 0 && !got.includes(a)) rest.splice(at, 1);
        }
        ja = [...ja.slice(0, i), ...keep, ...rest];
      }
      w++;
      continue;
    }
    if (c > 0 && c < 0x81) {
      i++;
      continue;
    }
    out.push(c);
    i++;
  }
  return out;
}

/**
 * The port's corrections to the scripts (talk.ts SCRIPT_FIXES), made to the Japanese strings `built` as the English
 * `fields` call for them: Weblock's two strings swapped back, Sir Arbuthnot's lost "y" put back, Thrud's gift.
 */
function fixScriptFields(fields: number[][], built: number[][]): void {
  const is = (f: number[] | undefined, bytes: number[]): boolean => !!f && f.length === bytes.length && bytes.every((b, i) => f[i] === b);
  const who = String.fromCharCode(...fields[0].filter((b) => b >= 0xa0).map((b) => b & 0x7f));
  if (who === 'Weblock')
    for (let i = 0; i + 2 < fields.length; i++)
      if (is(fields[i], [0xe7, 0xef, 0xf2, 0xee]) && is(fields[i + 1], [0xe8, 0xe1, 0xf3, 0xf3]) && fields[i + 2][0] === 0x87) {
        [built[i + 1], built[i + 2]] = [[0x87], [...built[i + 1], ...built[i + 2].slice(1)]];
        break;
      }
  if (who === 'Sir Arbuthnot')
    for (let i = 0; i + 1 < fields.length; i++)
      if (is(fields[i], [0xcf, 0xe8, 0xae]) && fields[i + 1][0] === 0xa7 && fields[i + 1][1] === 0xd4) {
        built.splice(i + 1, 0, [0xf9]);
        break;
      }
  if (who === 'Thrud')
    for (const f of built)
      for (let j = 0; j + 3 < f.length; j++)
        if (f[j] === 0x86 && f[j + 1] === 0x08 && f[j + 2] === 0x86 && f[j + 3] === 0x1c) f[j + 3] = 0x28;
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

const KW = kw as Record<string, string>;

/**
 * A townsman's keyword in Japanese, for the Say list (menu.ts sayMenu): the word the translation marks with it ("星"
 * for STAR, as "星(STAR)" says it), by the conversation's key and the keyword ("0:1:STAR"); undefined where none.
 */
export function keywordLabel(key: string): string | undefined {
  return ja() ? KW[key] : undefined;
}
