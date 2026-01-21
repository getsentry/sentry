import {useCallback, useEffect} from 'react';
import {useQueryState, type SingleParserBuilder} from 'nuqs';

import {defined} from 'sentry/utils';
import localStorageWrapper from 'sentry/utils/localStorage';

/**
 * Hook that syncs state between URL query parameters and localStorage.
 * URL takes precedence over localStorage, enabling URL sharing while
 * maintaining user preferences across sessions.
 *
 * Supports any data type via Nuqs parsers (parseAsString, parseAsInteger,
 * parseAsBoolean, parseAsArrayOf, etc.). The parser handles both URL and
 * localStorage serialization/deserialization.
 *
 * **Important**: Pass the parser WITHOUT `.withDefault()` - use the separate
 * `defaultValue` parameter instead. This ensures localStorage values are
 * properly prioritized over defaults.
 *
 * @param queryKey - The URL query parameter name
 * @param localStorageKey - The localStorage key
 * @param parser - Nuqs parser WITHOUT .withDefault(). Pass the base parser (parseAsString, parseAsInteger, etc.)
 * @param defaultValue - The default value when neither URL nor localStorage has a value
 * @returns Tuple of [effectiveValue, setValue]
 *
 * @example
 * // String values with default
 * const [sortBy, setSortBy] = useQueryStateWithLocalStorage(
 *   'sortBy',
 *   'dashboards:sortBy',
 *   parseAsString,
 *   'date'
 * );
 */
export function useQueryStateWithLocalStorage<T>(
  queryKey: string,
  localStorageKey: string,
  parser: SingleParserBuilder<T & {}>,
  defaultValue: T
): [T, (value: T & {}) => void] {
  // Detect if parser has a default value configured (runtime check)
  // Parsers with .withDefault() have a 'defaultValue' property
  //
  // If the parser has `.withDefault()`, it will _always_ return that default
  // instead of `null` when there's no URL param. This breaks our priority order
  // (URL > localStorage > default) because we can't distinguish between:
  //   1. No URL param exists (should fall back to localStorage)
  //   2. URL param explicitly set to the default value (should use that)
  // Both would return the same value, making localStorage never take effect.
  if ('defaultValue' in parser && defined(parser.defaultValue)) {
    throw new Error(
      `useQueryStateWithLocalStorage: parser should not have .withDefault() configured. ` +
        `Pass the base parser and use the separate defaultValue parameter instead.`
    );
  }

  // The authoritative state is from the URL parameter
  const [urlValue, setUrlValue] = useQueryState(queryKey, parser);

  // The fallback state is read from `localStorage` directly. We are not using
  // `useLocalStorageState` because we want to do the deserialization ourselves
  // according to Nuqs configuration.
  const stored = localStorageWrapper.getItem(localStorageKey);
  const localStorageValue = stored ? parser.parse(stored) : null;

  const effectiveValue = urlValue ?? localStorageValue ?? defaultValue;

  // Synchronize the URL state and the `localStorage` state by writing the URL
  // state into `localStorage`. This can happen on hook initialization, if the
  // URL query state has been updated by the user by some means other than
  // `setValue`.
  useEffect(() => {
    if (defined(urlValue)) {
      // Use parser's equality check if available (for arrays, objects, etc.)
      // Otherwise fall back to strict equality
      const areEqual =
        defined(localStorageValue) && 'eq' in parser && typeof parser.eq === 'function'
          ? parser.eq(urlValue, localStorageValue)
          : urlValue === localStorageValue;

      if (!areEqual) {
        const serializedUrlValue = parser.serialize(urlValue);
        localStorageWrapper.setItem(localStorageKey, serializedUrlValue);
      }
    }
  }, [parser, urlValue, localStorageValue, localStorageKey]);

  const setValue = useCallback(
    (value: T & {}) => {
      // `setURLValue` is async in Nuqs. Maybe it's because of throttling.
      // Normally we might want to `await` the Promise from `setUrlValue` but it'd
      // be bad for us to have the Nuqs state and the `localStorage` state be out
      // of sync because the `useEffect` above might re-run.
      setUrlValue(value);
      const serializedValue = parser.serialize(value);
      localStorageWrapper.setItem(localStorageKey, serializedValue);
    },
    [setUrlValue, parser, localStorageKey]
  );

  return [effectiveValue, setValue];
}
