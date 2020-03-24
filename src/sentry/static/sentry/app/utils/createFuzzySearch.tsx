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

  return new Fuse(objects, {
    ...DEFAULT_FUSE_OPTIONS,
    ...options,
  });
}
