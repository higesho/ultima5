/**
 * The Japanese edition's: every townsman's Japanese script as the engine builds it from the player's TLK file and the
 * translation (gameText.ts tlkScript), against the scripts the fork's tool builds the same way (JA_TLK_REF, a file
 * of them where it is set: the tool's reference, never shipped) - and, either way, every one built, its strings as
 * many as the English's (one more for Sir Arbuthnot's lost "y").
 */
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { tlkScript } from '../src/i18n/gameText.ts';
import { useLang } from '../src/i18n/i18n.ts';
import { gameFiles } from './helpers.ts';

it('builds every Japanese script from the player’s files and the translation', () => {
  useLang('ja');
  const files = gameFiles();
  const refFile = process.env.JA_TLK_REF;
  const ref = refFile ? (JSON.parse(readFileSync(refFile, 'utf8')) as Record<string, string[]>) : null;
  const differ: string[] = [];
  let built = 0;
  for (const name of ['TOWNE.TLK', 'DWELLING.TLK', 'CASTLE.TLK', 'KEEP.TLK']) {
    const d = files.get(name);
    const n = d[0] | (d[1] << 8);
    const offs = Array.from({ length: n }, (_, k) => d[4 + k * 4] | (d[5 + k * 4] << 8));
    for (let k = 0; k < n; k++) {
      const english = d.subarray(offs[k], k + 1 < n ? offs[k + 1] : d.length);
      const script = tlkScript(name, k, english);
      if (!script) continue;
      built++;
      const codes = Array.from(script);
      while (codes.length && codes[codes.length - 1] === 0) codes.pop();
      const strings = codes.filter((c) => c === 0).length + 1;
      const englishStrings = english.filter((c) => c === 0).length + 1;
      if (strings !== englishStrings && strings !== englishStrings + 1)
        differ.push(`${name} ${k}: ${strings} strings, English ${englishStrings}`);
      if (ref) {
        const want = Array.from(ref[name][k], (c) => c.charCodeAt(0));
        while (want.length && want[want.length - 1] === 0) want.pop();
        if (want.join() !== codes.join()) differ.push(`${name} ${k}: differs from the tool's`);
      }
    }
  }
  useLang('en');
  expect(built).toBe(135);
  expect(differ).toEqual([]);
});
