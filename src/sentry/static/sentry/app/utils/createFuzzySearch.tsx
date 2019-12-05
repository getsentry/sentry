import {DEFAULT_FUSE_OPTIONS} from 'app/constants';

export function loadFuzzySearch() {
  return import(/* webpackChunkName: "Fuse" */ 'fuse.js');
}

export function createFuzzySearch<
  T = string,
  Options extends Fuse.FuseOptions<T> = Fuse.FuseOptions<T>
>(objects: any[], options: Options): Promise<Fuse<T, Options>> {
  if (!options.keys) {
    throw new Error('You need to define `options.keys`');
  }

  return loadFuzzySearch()
    .then(mod => mod.default)
    .then(
      Fuse =>
        new Fuse(objects, {
          ...DEFAULT_FUSE_OPTIONS,
          ...options,
        })
    );
}
