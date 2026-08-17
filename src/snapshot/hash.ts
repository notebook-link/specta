export function computeHash(str: string): string {
  const s = str.replace(/\s+/g, ' ').trim();
  let h1 = 0xdeadbeef,
    h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (
    (h2 >>> 0).toString(16).padStart(8, '0') +
    (h1 >>> 0).toString(16).padStart(8, '0')
  );
}

/**
 * Identity of a notebook's code, used to tell whether a snapshot still matches
 * the notebook it was taken from.
 *
 * Accepts either shape nbformat allows for `source`. Note that `computeHash`
 * collapses runs of whitespace, so the result is insensitive to reindentation.
 */
export function snapshotHash(sources: Array<string | string[]>): string {
  return computeHash(
    sources.map(s => (Array.isArray(s) ? s.join('') : s)).join('\n')
  );
}
