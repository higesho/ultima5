/**
 * i18n.ts
 *
 * The language the game is shown in: English, as the game and the port have it, or Japanese. The machine's choice,
 * not a character's (it is wanted before any character is chosen: the installer, the title), kept in local storage;
 * changing it starts the page again, since what is shown is chosen as it is read.
 *
 * Japanese text is held by the port, keyed by what it stands for: the port's own English (ui.json, L), a string of
 * DATA.OVL by its address (ovl.json), a townsman's strings by file, person and string (tlk.json), and the strings of
 * the other text files by file and offset (dat.json). A Japanese letter is one character of a JavaScript string, at
 * or above U+0100 (isWide), drawn in one text cell like any letter (jfont.ts).
 */

import ui from './ja/ui.json';

export type Lang = 'en' | 'ja';
export const LANGS: Lang[] = ['ja', 'en'];
export const LANG_NAMES: Record<Lang, string> = { ja: '日本語', en: 'English' };

const KEY = 'ultima5.language';

function stored(): Lang {
  try {
    const v = globalThis.localStorage?.getItem(KEY);
    if (v === 'en' || v === 'ja') return v;
  } catch {
    // no storage: the default
  }
  // Japanese in a page (this is the Japanese edition); English elsewhere - the tests, and the tools - as the port is.
  return typeof window === 'undefined' ? 'en' : 'ja';
}

let current: Lang = stored();

/** The language shown. */
export const lang = (): Lang => current;

/** Whether Japanese is shown. */
export const ja = (): boolean => current === 'ja';

/** Choose the language, kept for the next start (the caller starts the page again). */
export function setLang(l: Lang): void {
  current = l;
  try {
    globalThis.localStorage?.setItem(KEY, l);
  } catch {
    // kept for this page only
  }
}

/** For the tests: the language without keeping it. */
export function useLang(l: Lang): void {
  current = l;
}

const UI = ui as Record<string, string>;

/**
 * The port's own text in the language shown: `en` as it is, or its Japanese. `{0}`, `{1}`... in the text take `args`
 * in turn, in either language (a Japanese line may put them in its own order).
 */
export function L(en: string, ...args: (string | number)[]): string {
  const s = current === 'ja' ? (UI[en] ?? en) : en;
  return args.length ? s.replace(/\{(\d+)\}/g, (m, i: string) => (Number(i) < args.length ? String(args[Number(i)]) : m)) : s;
}

/** The port's lines with parts filled in (`{0}`...): each a pattern that finds them, and the order of its parts. */
let patterns: { re: RegExp; to: string; parts: number[] }[] | null = null;

function compile(): { re: RegExp; to: string; parts: number[] }[] {
  const out: { re: RegExp; to: string; parts: number[] }[] = [];
  for (const [en, to] of Object.entries(UI)) {
    if (!/\{\d+\}/.test(en)) continue;
    // At least a word of its own, not only its parts: "{0} {1}" would take every line.
    if ((en.replace(/\{\d+\}/g, '').match(/[A-Za-z]/g) ?? []).length < 4) continue;
    const parts: number[] = [];
    const source = en
      .split(/(\{\d+\})/)
      .map((piece) => {
        const m = /^\{(\d+)\}$/.exec(piece);
        if (!m) return piece.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        parts.push(Number(m[1]));
        return '([\\s\\S]+?)';
      })
      .join('');
    out.push({ re: new RegExp(`^${source}$`), to, parts });
  }
  // The longest first: the more of a line a pattern spells out, the surer its match.
  return out.sort((a, b) => b.re.source.length - a.re.source.length);
}

/** Lines seen in Japanese that the dictionary had not (for the fork's checking: window.u5ja.missing). */
const missing = new Set<string>();
if (typeof window !== 'undefined') (window as unknown as { u5ja?: unknown }).u5ja = { missing };

/**
 * A line of the port's on its way to the screen, in the language shown (the fork's): its Japanese where the
 * dictionary (ui.json) has it - whole, or as a pattern whose parts are themselves looked up ("Attack ({0})") - else
 * as it is. Applied where the port shows its lines (text.ts print, the menus), so its source keeps its English.
 */
export function tr(s: string): string {
  if (current !== 'ja' || s.length < 2 || !/[A-Za-z]{2}/.test(s)) return s;
  const hit = UI[s];
  if (hit !== undefined) return hit === 'KEEP' ? s : hit;
  // Spaces about a line are the layout's: the line within them.
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s)!;
  if (m[1] || m[3]) {
    const inner = UI[m[2]];
    if (inner !== undefined) return inner === 'KEEP' ? s : m[1] + inner + m[3];
  }
  patterns ??= compile();
  for (const p of patterns) {
    const found = p.re.exec(s);
    if (!found) continue;
    if (p.to === 'KEEP') return s;
    const parts = new Map<number, string>();
    p.parts.forEach((n, i) => parts.set(n, tr(found[i + 1])));
    return p.to.replace(/\{(\d+)\}/g, (all, n: string) => parts.get(Number(n)) ?? all);
  }
  if (!hasWide(s)) missing.add(s);
  return s;
}

/** Whether a character code is a wide (Japanese) letter: drawn from the Japanese fonts, one text cell wide. */
export const isWide = (code: number): boolean => code >= 0x100;

/** Whether a string holds any Japanese. */
export const hasWide = (s: string): boolean => /[Ā-￿]/.test(s);

/** Letters a line may not begin with (kinsoku): closing marks and the small kana. */
const NO_START = new Set(Array.from('、。，．・：；？！ー」』）】〕〉》”’ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ々…‥〜～!?)]}.,:;'));
/** Letters a line may not end with: opening marks. */
const NO_END = new Set(Array.from('「『（【〔〈《“‘([{'));

/**
 * Where a line may break between `prev` and `next` in Japanese text: between two wide letters, or a wide letter and
 * a narrow one, unless kinsoku forbids it; between two narrow letters only at a space, as in English.
 */
export function canBreak(prev: string, next: string): boolean {
  if (!prev || !next) return true;
  if (next === ' ' || prev === ' ') return true;
  const p = prev.charCodeAt(0);
  const n = next.charCodeAt(0);
  if (!isWide(p) && !isWide(n)) return false;
  if (NO_START.has(next) || NO_END.has(prev)) return false;
  return true;
}

/**
 * Text broken into lines of at most `width` letters (the first `first`), at spaces and between Japanese letters,
 * keeping kinsoku; a newline breaks a line. Spaces at a break are dropped. A word longer than a line is cut.
 */
export function wrapLines(text: string, width: number, first = width): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let rest = para;
    let room = out.length === 0 ? first : width;
    if (rest === '') {
      out.push('');
      continue;
    }
    while (rest.length > room) {
      let cut = -1;
      for (let i = room; i > 0; i--)
        if (canBreak(rest[i - 1], rest[i])) {
          cut = i;
          break;
        }
      if (cut <= 0) cut = room;
      out.push(rest.slice(0, cut).trimEnd());
      rest = rest.slice(cut).replace(/^ +/, '');
      room = width;
    }
    out.push(rest);
  }
  return out;
}
