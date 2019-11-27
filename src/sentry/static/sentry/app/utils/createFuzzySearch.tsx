import {DEFAULT_FUSE_OPTIONS} from 'app/constants';

export function loadFuzzySearch() {
  return import(/* webpackChunkName: "Fuse" */ 'fuse.js');
}

type FuzzyOptions = {
  keys?: string[] | {name: string; weight: number}[];
};

export function createFuzzySearch(
  objects: any[],
  options: FuzzyOptions = {}
): Promise<Fuse> {
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
