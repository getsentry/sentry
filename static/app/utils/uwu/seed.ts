export type Random = () => number;

/**
 * xmur3, used to expand a string into the four 32-bit words sfc32 needs.
 *
 * https://github.com/bryc/code/blob/master/jshash/PRNGs.md
 */
function createSeedSource(seed: string): () => number {
  let h = 1779033703 ^ seed.length;

  for (let index = 0; index < seed.length; index++) {
    h = Math.imul(h ^ seed.charCodeAt(index), 3432918353);
    h = (h << 13) | (h >>> 19);
  }

  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/**
 * sfc32. Seeded from a string rather than from a clock so that a given phrase
 * always produces the same sequence — the whole feature depends on it.
 *
 * https://github.com/bryc/code/blob/master/jshash/PRNGs.md
 */
export function createRandom(seed: string): Random {
  const source = createSeedSource(seed);

  let a = source();
  let b = source();
  let c = source();
  let d = source();

  return () => {
    // `| 0` wraps to a signed 32-bit integer, which the algorithm relies on.
    // `Math.trunc` is not a substitute — it would keep values above 2^31.
    /* eslint-disable unicorn/prefer-math-trunc */
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    /* eslint-enable unicorn/prefer-math-trunc */
    return (t >>> 0) / 4294967296;
  };
}

export function pick<T>(random: Random, items: readonly T[]): T {
  return items[Math.floor(random() * items.length)]!;
}
