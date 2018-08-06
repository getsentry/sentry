import {DEFAULT_FUSE_OPTIONS} from 'app/constants';

export function loadFuzzySearch() {
  return import('fuse.js');
}

export function createFuzzySearch(objects, options = {}) {
  if (!options.keys) {
    throw new Error('You need to define `options.keys`');
  }

  return loadFuzzySearch().then(
    Fuse =>
      new Fuse(objects, {
        ...DEFAULT_FUSE_OPTIONS,
        ...options,
      })
  );
}
