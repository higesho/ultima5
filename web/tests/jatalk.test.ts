/**
 * The Japanese edition's: every townsman's conversation in Japanese (gameText.ts tlkScript), met and not, every word
 * the game teaches known and each Say line asked - that each ends, and what each says, written out for reading over
 * (JA_TALK_OUT, a file, where it is set). English left in a townsman's words is listed: their keywords' marks
 * ("(SPIR)"), the words they listen for and names apart.
 */
import { appendFileSync, writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import type { Game } from '../src/game/game.ts';
import { K, Pad } from '../src/game/io.ts';
import { journeyOnward } from '../src/game/run.ts';
import { talkToNpc } from '../src/game/talk.ts';
import { waitsForKey } from '../src/game/speech.ts';
import { tr, useLang } from '../src/i18n/i18n.ts';
import { newGame } from './helpers.ts';
import { analyse } from '../tools/talk/analysis.ts';
import { townsfolk, type Townsman } from '../tools/talk/reach.ts';

const NPC = ['TOWNE.NPC', 'DWELLING.NPC', 'CASTLE.NPC', 'KEEP.NPC'];
type Seat = { map: number; npc: number; talk: number; t: Townsman };
function seats(g: Game, folk: Townsman[]): Seat[] {
  const out: Seat[] = [];
  for (let map = 1; map <= 32; map++) {
    const f = (map - 1) >> 3;
    const npcs = g.data.files.get(NPC[f]);
    const m = (map - 1) & 7;
    for (let npc = 0; npc < 32; npc++) {
      const talk = npcs[m * 0x240 + 0x220 + npc];
      if (talk === 0 || talk >= 0x80) continue;
      const t = folk.find((x) => x.key === `${f}:${talk}`);
      if (t && !out.some((s) => s.t.key === t.key)) out.push({ map, npc, talk, t });
    }
  }
  return out;
}

const talk = async (seat: Seat, words: string[], met: boolean): Promise<string> => {
  const { g, p } = newGame(seat.map * 100 + seat.npc);
  journeyOnward(g);
  for (const w of words) g.words.learn(g, w);
  Object.assign(g.options, { input: 'controller', dialog: process.env.JA_DIALOG === 'play' ? 'play' : 'log', rules: 'classic' });
  Object.assign(g.s, { mapId: seat.map, gold: 9999, townAir: 0xff, karma: 99 });
  g.s.npcs[seat.npc].fa = seat.talk;
  if (met) g.s.npcMet[(seat.map - 1) * 4 + (seat.npc >> 3)] |= 1 << (seat.npc & 7);
  let log = '';
  const gg = g as unknown as { remember: (t: string) => void };
  const remember = gg.remember.bind(g);
  gg.remember = (t: string) => {
    if (g.p.text.current === 2 || g.p.text.current === 4) log += t;
    remember(t);
  };
  const asked = new Set<string>();
  const leave = tr('Take leave');
  let presses = 0;
  let answers = 0;
  p.next = () => {
    if (++presses > 3000) throw new Error('never ends');
    if (waitsForKey(g)) return Pad.A;
    const m = g.menuShown;
    if (!m) return Pad.A;
    let target: number;
    if (m.title === tr('Say')) {
      const open = m.labels.map((l, i) => ({ l, i })).filter(({ l }) => l !== leave && !asked.has(l));
      target = open.length ? open[0].i : m.labels.indexOf(leave);
      if (open.length && m.at === target) asked.add(open[0].l);
    } else {
      const choices = m.labels.map((_, i) => i).filter((i) => m.labels[i] !== leave);
      target = choices.length ? choices[answers % choices.length] : 0;
      if (m.at === target) answers++;
    }
    return m.at === target ? Pad.A : m.at < target ? K.Down : K.Up;
  };
  try {
    await talkToNpc(g, seat.npc);
  } catch (e) {
    log += `\n[ended: ${String(e).slice(0, 80)}]`;
  }
  return log;
};

it('says every conversation in Japanese, to its end', async () => {
  useLang('ja');
  const { g } = newGame();
  journeyOnward(g);
  const all = seats(g, townsfolk(g));
  const learnable = [...analyse(g).learnable.keys()];
  const out: string[] = [];
  const english: string[] = [];
  const ended: string[] = [];
  for (const seat of all)
    for (const met of [false, true]) {
      const progress = process.env.JA_TALK_PROGRESS;
      if (progress) appendFileSync(progress, `${seat.t.name} ${seat.t.key} map ${seat.map} npc ${seat.npc}${met ? ' met' : ''} ... `);
      const log = await talk(seat, learnable, met);
      if (progress) appendFileSync(progress, `${log.length}\n`);
      out.push(`==== ${seat.t.name} (map ${seat.map} npc ${seat.npc} ${seat.t.key}${met ? ', met' : ''})\n${log}`);
      if (/\[ended:/.test(log)) ended.push(`${seat.t.name}${met ? ' (met)' : ''}: ${/\[ended: (.*)\]/.exec(log)?.[1]}`);
      // English words in their speech: not a mark "(XXXX)", nor a word typed (":word"), nor a name.
      const lines = log.split('\n').filter((l) => !/^\s*:/.test(l));
      const words = lines
        .join(' ')
        .replace(/\([A-Z ]{1,8}\)/g, '')
        .match(/[A-Za-z][a-z]{3,}/g);
      if (words) english.push(`${seat.t.name}: ${[...new Set(words)].join(' ')}`);
    }
  const file = process.env.JA_TALK_OUT;
  if (file) writeFileSync(file, out.join('\n\n') + '\n\nENGLISH LEFT\n' + english.join('\n') + '\n\nENDED\n' + ended.join('\n') + '\n');
  useLang('en');
  expect(ended).toEqual([]);
}, 1800000);
