import type Fuse from 'fuse.js';

import {DEFAULT_FUSE_OPTIONS} from 'sentry/constants';

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
