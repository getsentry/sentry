import type {LocationDescriptorObject} from 'history';

/**
 * Unsets all cursor-related properties in a location query object by setting them to `undefined`.
 * Useful for resetting pagination state on pages with a single paginated list.
 * @returns An object with all keys containing "cursor" set to `undefined`
 */
export function unsetQueryCursors(query: LocationDescriptorObject['query']) {
  if (!query) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(query)
      .filter(([key]) => key.toLowerCase().includes('cursor'))
      .map(([key]) => [key, undefined])
  );
}
