/**
 * The Japanese edition's: the port's menus and pages as the player sees them in Japanese (i18n.ts tr) - Settings,
 * Gameplay, Audio, the tips, the help pages, the cheats - and what of them is still English, written out
 * (JA_MENUS_OUT) for the dictionary to take in.
 */
import { writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { journeyOnward } from '../src/game/run.ts';
import { audioLines, gameplayLines, settingLines, transferLines, wrap } from '../src/game/menu.ts';
import { TIPS, topicLines } from '../src/game/tips.ts';
import { helpPages } from '../src/game/help.ts';
import { CHEATS } from '../src/game/cheats.ts';
import { tr, useLang } from '../src/i18n/i18n.ts';
import { newGame } from './helpers.ts';

it('shows the port’s menus and pages in Japanese', () => {
  useLang('ja');
  const { g } = newGame();
  journeyOnward(g);
  const seen: string[] = [];
  const add = (s: string | undefined): void => {
    if (s) seen.push(tr(s));
  };
  for (const lines of [settingLines(g, true), settingLines(g, false), gameplayLines(g), audioLines(g), transferLines(g)])
    for (const l of lines) {
      add(l.label);
      add(l.note);
    }
  for (const t of TIPS) {
    add(t.topic);
    for (const l of topicLines(t)) for (const w of wrap(l, 36)) seen.push(w);
  }
  for (const p of helpPages(g)) {
    add(p.title);
    p.lines.forEach(add);
  }
  for (const c of CHEATS) {
    add(c.label);
    add((c as { note?: string }).note);
  }
  const english = [...new Set(seen.filter((s) => /[A-Za-z]{3,}/.test(s.replace(/\([A-Z ]+\)/g, ''))))];
  const file = process.env.JA_MENUS_OUT;
  if (file) writeFileSync(file, english.join('\n') + '\n');
  useLang('en');
  expect(seen.length).toBeGreaterThan(50);
});
