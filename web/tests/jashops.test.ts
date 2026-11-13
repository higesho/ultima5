/**
 * The Japanese edition's: every kind of merchant, in each town that has one, in Japanese - what each says, written
 * out for reading over (JA_SHOPS_OUT, a file, where it is set), and that each visit ends.
 */
import { writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { K } from '../src/game/io.ts';
import { journeyOnward } from '../src/game/run.ts';
import { enterTown } from '../src/game/town.ts';
import { useLang } from '../src/i18n/i18n.ts';
import { keys, newGame } from './helpers.ts';

it('trades at every merchant in Japanese', async () => {
  useLang('ja');
  const { merchant } = await import('../src/game/shops.ts');
  const out: string[] = [];
  const ended: string[] = [];
  for (let kind = 0x81; kind <= 0x88; kind++) {
    const { g } = newGame();
    const maps = g.data.bytes(0x23ca + (kind - 0x81) * 16, 16);
    for (const map of [...new Set(maps)].filter((m) => m > 0 && m <= 32).slice(0, 3)) {
      const { g, p } = newGame(kind * 100 + map);
      journeyOnward(g);
      Object.assign(g.s, { mapId: map, hour: 12, gold: 900 });
      await enterTown(g, true);
      p.log = '';
      p.keys.push(...keys('Y', 'B', 'A', 'Y', 'Y', K.Space, 'N', K.Space), ...Array<number>(40).fill(K.Space));
      try {
        await merchant(g, kind);
      } catch (e) {
        ended.push(`${kind.toString(16)} map ${map}: ${String(e).slice(0, 80)}`);
      }
      out.push(`==== kind ${kind.toString(16)} map ${map}\n${p.log}`);
    }
  }
  const file = process.env.JA_SHOPS_OUT;
  if (file) writeFileSync(file, out.join('\n\n') + '\n\nENDED\n' + ended.join('\n') + '\n');
  useLang('en');
  expect(ended).toEqual([]);
}, 600000);
