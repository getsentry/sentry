import {createParser, type ParserBuilder} from 'nuqs';

import Storage from 'sentry/utils/localStorage';

/**
 * Wraps a Nuqs parser to add localStorage fallback support with two-way sync.
 *
 * Storage Hierarchy: URL params (primary) ↔ localStorage (fallback/default)
 *
 * Sync Strategy:
 * - On mount: If URL is empty but localStorage has a value → update URL
 * - On read: Always read from URL first, fall back to localStorage if URL is empty
 * - On write: Write to both URL and localStorage simultaneously
 *
 * Edge Cases Handled:
 * - localStorage unavailable → continues without storage
 * - localStorage quota exceeded → silently fails writes
 * - Corrupted JSON in localStorage → cleans up and returns null
 * - Both URL and localStorage empty → returns null (allows .withDefault() to work)
 *
 * @param storageKey - The localStorage key to use (e.g., 'insights:sort', 'agents:cursor')
 * @param parser - Any Nuqs parser (parseAsString, parseAsInteger, custom parsers, etc.)
 * @returns A new parser with localStorage support
 *
 * @example
 * // Simple string with localStorage fallback
 * const [query, setQuery] = useQueryState(
 *   'query',
 *   withLocalStorage('search:query', parseAsString).withDefault('')
 * );
 *
 * @example
 * // Sort with localStorage persistence
 * const [sort, setSort] = useQueryState(
 *   'sort',
 *   withLocalStorage('table:sort', parseAsSort).withDefault({
 *     kind: 'desc',
 *     field: 'created'
 *   })
 * );
 */
export function withLocalStorage<T>(
  storageKey: string,
  parser: ParserBuilder<T>
): ParserBuilder<T> {
  return createParser<T>({
    parse: (urlValue: string | null) => {
      // URL is empty - try localStorage fallback
      if (urlValue === null) {
        const storedValue = Storage.getItem(storageKey);
        if (storedValue === null) {
          // Both URL and localStorage are empty
          // Return null to allow .withDefault() to work
          return null;
        }

        // Parse the stored value
        try {
          return JSON.parse(storedValue) as T;
        } catch {
          // Corrupted localStorage data - clean up and return null
          try {
            Storage.removeItem(storageKey);
          } catch {
            // Do nothing
          }
          return null;
        }
      }

      // URL has a value - use it as source of truth and sync it to localStorage
      const parsed = parser.parse(urlValue);
      if (parsed !== null) {
        try {
          Storage.setItem(storageKey, JSON.stringify(parsed));
        } catch {
          // localStorage quota exceeded or unavailable - continue without storage
        }
      }

      return parsed;
    },

    serialize: (value: T) => {
      try {
        Storage.setItem(storageKey, JSON.stringify(value));
      } catch {
        // Do nothing
      }

      return parser.serialize(value);
    },
  });
}
