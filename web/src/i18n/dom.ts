/**
 * dom.ts
 *
 * The port's pages over the game (the installer, notices, the crash report) in the language shown (the fork's): each
 * piece of their text looked up as the menus' lines are (i18n.ts tr), when it is set and whenever it changes.
 */

import { ja, tr } from './i18n.ts';

/** Every piece of text under `root` in the language shown, the spaces about it kept. */
export function translateTree(root: Node): void {
  if (!ja()) return;
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  for (let n = walk.nextNode(); n; n = walk.nextNode()) nodes.push(n as Text);
  for (const node of nodes) translateText(node);
}

function translateText(node: Text): void {
  const raw = node.data;
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(raw);
  if (!m || !m[2]) return;
  // The text as written in the source, its runs of spaces and line breaks one space (as the page shows it).
  const plain = m[2].replace(/\s+/g, ' ');
  const shown = tr(plain);
  if (shown !== plain) node.data = m[1] + shown + m[3];
}

/** Keep `root`'s text in the language shown as it changes (a status line set, a button relabelled). */
export function keepTranslated(root: Node): () => void {
  if (!ja() || typeof MutationObserver === 'undefined') return () => {};
  translateTree(root);
  const seen = new MutationObserver((changes) => {
    for (const c of changes) {
      if (c.type === 'characterData') translateText(c.target as Text);
      else c.addedNodes.forEach((n) => (n.nodeType === Node.TEXT_NODE ? translateText(n as Text) : translateTree(n)));
    }
  });
  seen.observe(root, { subtree: true, childList: true, characterData: true });
  return () => seen.disconnect();
}
