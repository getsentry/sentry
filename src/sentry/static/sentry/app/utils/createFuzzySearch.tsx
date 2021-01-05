import {DEFAULT_FUSE_OPTIONS} from 'app/constants';

export function loadFuzzySearch() {
  return import(/* webpackChunkName: "Fuse" */ 'fuse.js');
}

export async function createFuzzySearch<
  T = string,
  Options extends Fuse.FuseOptions<T> = Fuse.FuseOptions<T>
>(objects: any[], options: Options): Promise<Fuse<T, Options>> {
  if (!options.keys) {
    throw new Error('You need to define `options.keys`');
  }

  const {default: Fuse} = await loadFuzzySearch();
  const opts = {
    ...DEFAULT_FUSE_OPTIONS,
    ...options,
  };
  return new Fuse(objects, opts);
}

export function isResultWithMatches<T>(
  maybe: T | Fuse.FuseResultWithMatches<T>
): maybe is Fuse.FuseResultWithMatches<T> {
  return (maybe as Fuse.FuseResultWithMatches<T>).matches !== undefined;
}
