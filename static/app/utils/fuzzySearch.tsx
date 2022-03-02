import type Fuse from 'fuse.js';

// See http://fusejs.io/ for more information
export const DEFAULT_FUSE_OPTIONS: Fuse.IFuseOptions<any> = {
  includeScore: true,
  includeMatches: true,
  threshold: 0.4,
  location: 0,
  distance: 75,
  minMatchCharLength: 2,
};

export async function createFuzzySearch<
  T = string,
  Options extends Fuse.IFuseOptions<T> = Fuse.IFuseOptions<T>
>(objects: T[], options: Options): Promise<Fuse<T>> {
  if (!options.keys) {
    throw new Error('You need to define `options.keys`');
  }

  const fuseImported = await import('fuse.js');
  const fuse = {Fuse: fuseImported.default};

  return new fuse.Fuse(objects, {
    ...DEFAULT_FUSE_OPTIONS,
    ...options,
  });
}

// re-export fuse type to make it easier to use
export type {Fuse};
