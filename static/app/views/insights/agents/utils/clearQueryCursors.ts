import type {LocationDescriptorObject} from 'history';

/**
 * Removes all cursor-related properties from a location query object.
 * Intended for pages that render a single pagination only.
 * @returns All properties containing the word "cursor" with the value undefined
 */
export function clearQueryCursors(query: LocationDescriptorObject['query']) {
  if (!query) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(query)
      .filter(([key]) => key.toLowerCase().includes('cursor'))
      .map(([key]) => [key, undefined])
  );
}
