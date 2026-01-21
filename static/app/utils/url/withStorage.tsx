import {createParser} from 'nuqs';

import localStorage from 'sentry/utils/localStorage';
import sessionStorage from 'sentry/utils/sessionStorage';

/**
 * Wraps a Nuqs parser to add storage fallback support with two-way sync.
 *
 * Storage Hierarchy: URL params (primary) ↔ storage (fallback/default)
 *
 * Sync Strategy:
 * - On mount: If URL is empty but storage has a value → update URL
 * - On read: Always read from URL first, fall back to storage if URL is empty
 * - On write: Write to both URL and storage simultaneously
 *
 * Edge Cases Handled:
 * - Storage unavailable → continues without storage
 * - Storage quota exceeded → silently fails writes
 * - Corrupted JSON in storage → cleans up and returns null
 * - Both URL and storage empty → returns null (allows .withDefault() to work)
 *
 * @param storage - Storage implementation (e.g., localStorage, sessionStorage)
 * @param storageKey - The storage key to use (e.g., 'insights:sort', 'agents:cursor')
 * @param parser - Any Nuqs parser (parseAsString, parseAsInteger, custom parsers, etc.)
 * @returns A new parser with storage support
 *
 * @example
 * // Using localStorage
 * const [query, setQuery] = useQueryState(
 *   'query',
 *   withStorage(localStorage, 'search:query', parseAsString).withDefault('')
 * );
 *
 * @example
 * // Using sessionStorage
 * const [temp, setTemp] = useQueryState(
 *   'temp',
 *   withStorage(sessionStorage, 'temp:data', parseAsString)
 * );
 */
export function withStorage<T>(storage: Storage, storageKey: string, parser: {
  parse: (value: string) => T | null;
  serialize: (value: T) => string;
}) {
  return createParser<T>({
    parse: (urlValue: string | null) => {
      // URL is empty - try storage fallback
      if (urlValue === null) {
        let storedValue: string | null = null;
        try {
          storedValue = storage.getItem(storageKey);
        } catch {
          // Storage unavailable - return null
          return null;
        }

        if (storedValue === null) {
          // Both URL and storage are empty
          // Return null to allow .withDefault() to work
          return null;
        }

        // Parse the stored value
        try {
          return JSON.parse(storedValue) as T;
        } catch {
          // Corrupted storage data - clean up and return null
          try {
            storage.removeItem(storageKey);
          } catch {
            // Do nothing
          }
          return null;
        }
      }

      // URL has a value - use it as source of truth and sync it to storage
      const parsed = parser.parse(urlValue);
      if (parsed !== null) {
        try {
          storage.setItem(storageKey, JSON.stringify(parsed));
        } catch {
          // Storage quota exceeded or unavailable - continue without storage
        }
      }

      return parsed;
    },

    serialize: (value: T) => {
      try {
        storage.setItem(storageKey, JSON.stringify(value));
      } catch {
        // Do nothing
      }

      return parser.serialize(value);
    },
  });
}

/**
 * Wraps a Nuqs parser to add localStorage fallback support with two-way sync.
 *
 * Convenience wrapper around withStorage that uses localStorage.
 * localStorage persists across browser sessions.
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
export function withLocalStorage<T>(storageKey: string, parser: {
  parse: (value: string) => T | null;
  serialize: (value: T) => string;
}) {
  return withStorage(localStorage, storageKey, parser);
}

/**
 * Wraps a Nuqs parser to add sessionStorage fallback support with two-way sync.
 *
 * Convenience wrapper around withStorage that uses sessionStorage.
 * sessionStorage clears when the browser tab closes, making it ideal for
 * temporary state that shouldn't persist across sessions.
 *
 * @param storageKey - The sessionStorage key to use (e.g., 'wizard:step', 'draft:content')
 * @param parser - Any Nuqs parser (parseAsString, parseAsInteger, custom parsers, etc.)
 * @returns A new parser with sessionStorage support
 *
 * @example
 * // Wizard step that clears when tab closes
 * const [step, setStep] = useQueryState(
 *   'step',
 *   withSessionStorage('wizard:step', parseAsInteger).withDefault(1)
 * );
 *
 * @example
 * // Temporary filter that doesn't persist across sessions
 * const [draftMode, setDraftMode] = useQueryState(
 *   'draft',
 *   withSessionStorage('editor:draft', parseAsBooleanLiteral)
 * );
 */
export function withSessionStorage<T>(storageKey: string, parser: {
  parse: (value: string) => T | null;
  serialize: (value: T) => string;
}) {
  return withStorage(sessionStorage, storageKey, parser);
}
