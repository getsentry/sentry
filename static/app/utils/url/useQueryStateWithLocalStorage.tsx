import {useCallback, useEffect, useState} from 'react';
import {useQueryState, type GenericParserBuilder, type MultiParserBuilder} from 'nuqs';

import {defined} from 'sentry/utils';
import localStorageWrapper from 'sentry/utils/localStorage';

/**
 * Type guard to detect if a parser is a MultiParserBuilder.
 * Multi parsers require special handling for localStorage.
 */
function isMultiParser<T>(
  parser: GenericParserBuilder<T>
): parser is MultiParserBuilder<T> {
  return (parser as MultiParserBuilder<T>).type === 'multi';
}

/**
 * Parse a value from localStorage based on parser type.
 * - Single parsers: parse string directly
 * - Multi parsers: parse JSON array first, then pass to parser
 */
function parseFromLocalStorage<T>(
  stored: string,
  parser: GenericParserBuilder<T>
): T | null {
  if (isMultiParser(parser)) {
    try {
      const array = JSON.parse(stored);
      if (Array.isArray(array)) {
        return parser.parse(array);
      }
      return null;
    } catch {
      return null;
    }
  }
  return parser.parse(stored);
}

/**
 * Serialize a value to localStorage based on parser type.
 * - Single parsers: serialize returns string directly
 * - Multi parsers: serialize returns Array<string>, store as JSON
 */
function serializeToLocalStorage<T>(value: T, parser: GenericParserBuilder<T>): string {
  if (isMultiParser(parser)) {
    const serialized = parser.serialize(value);
    return JSON.stringify(serialized);
  }
  return parser.serialize(value);
}

/**
 * Hook that syncs state between URL query parameters and localStorage.
 * After initial mount, URL becomes the single source of truth. On mount, if URL
 * is empty and localStorage has a value, the URL is populated with that value.
 *
 * Supports both SingleParserBuilder (parseAsString, parseAsInteger, parseAsArrayOf)
 * and MultiParserBuilder for maximum flexibility.
 *
 * **Important**: Pass the parser WITHOUT `.withDefault()` - use the separate
 * `defaultValue` parameter instead. This is enforced at runtime.
 *
 * @param queryKey - The URL query parameter name
 * @param localStorageKey - The localStorage key
 * @param parser - Nuqs parser WITHOUT .withDefault()
 * @param defaultValue - The default value when URL has no value
 * @returns Tuple of [value, setValue] where setValue accepts value or null to clear
 *
 * @example
 * // String values
 * const [sortBy, setSortBy] = useQueryStateWithLocalStorage(
 *   'sortBy',
 *   'dashboards:sortBy',
 *   parseAsString,
 *   'date'
 * );
 * setSortBy('name'); // Set to 'name'
 * setSortBy(null);   // Clear and return to default 'date'
 *
 * @example
 * // Array with parseAsArrayOf (SingleParser)
 * const [tags, setTags] = useQueryStateWithLocalStorage(
 *   'tags',
 *   'filters:tags',
 *   parseAsArrayOf(parseAsString),
 *   []
 * );
 */
export function useQueryStateWithLocalStorage<T>(
  queryKey: string,
  localStorageKey: string,
  parser: GenericParserBuilder<T>,
  defaultValue: T
): [T, (value: T | null) => void] {
  // Detect if parser has a default value configured (runtime check)
  // Parsers with .withDefault() have a 'defaultValue' property
  //
  // If the parser has `.withDefault()`, it will _always_ return that default
  // instead of `null` when there's no URL param. This breaks our priority
  // because we need the parser to return null when there's no URL value.
  //
  // Note: MultiParsers may have internal defaultValue handling that's different,
  // so we skip this check for them.
  if (
    !isMultiParser(parser) &&
    'defaultValue' in parser &&
    defined(parser.defaultValue)
  ) {
    throw new Error(
      `useQueryStateWithLocalStorage: parser should not have .withDefault() configured. ` +
        `Pass the base parser and use the separate defaultValue parameter instead.`
    );
  }

  // The authoritative state is from the URL parameter
  const [urlValue, setUrlValue] = useQueryState(queryKey, parser);

  // Track whether we've initialized from localStorage
  const [initialized, setInitialized] = useState(false);

  // On mount, read localStorage ONCE and populate URL if empty
  // This ensures localStorage is only read on mount, not on every render
  useEffect(() => {
    if (!initialized && !defined(urlValue)) {
      const stored = localStorageWrapper.getItem(localStorageKey);
      if (defined(stored)) {
        const parsed = parseFromLocalStorage(stored, parser);
        if (defined(parsed)) {
          // Cast to satisfy Nuqs's type signature (T & {} excludes null/undefined)
          setUrlValue(parsed as T & {});
        }
      }
      setInitialized(true);
    }
  }, [initialized, urlValue, localStorageKey, parser, setUrlValue]);

  // After initialization, URL is the single source of truth
  const effectiveValue = urlValue ?? defaultValue;

  // Synchronize URL changes to localStorage
  // This happens when URL is updated by external means (e.g., browser back/forward)
  useEffect(() => {
    if (defined(urlValue)) {
      const storedRaw = localStorageWrapper.getItem(localStorageKey);
      const storedValue = defined(storedRaw)
        ? parseFromLocalStorage(storedRaw, parser)
        : null;

      // Use parser's equality check if available (for arrays, objects, etc.)
      const areEqual =
        defined(storedValue) && 'eq' in parser && typeof parser.eq === 'function'
          ? parser.eq(urlValue, storedValue)
          : urlValue === storedValue;

      if (!areEqual) {
        const serializedUrlValue = serializeToLocalStorage(urlValue, parser);
        localStorageWrapper.setItem(localStorageKey, serializedUrlValue);
      }
    }
  }, [parser, urlValue, localStorageKey]);

  const setValue = useCallback(
    (value: T | null) => {
      if (value === null) {
        // Clear both URL and localStorage
        setUrlValue(null);
        localStorageWrapper.removeItem(localStorageKey);
      } else {
        // Set value in both URL and localStorage
        // Cast to satisfy Nuqs's type signature (T & {} excludes null/undefined)
        setUrlValue(value as T & {});
        const serializedValue = serializeToLocalStorage(value, parser);
        localStorageWrapper.setItem(localStorageKey, serializedValue);
      }
    },
    [setUrlValue, parser, localStorageKey]
  );

  return [effectiveValue, setValue];
}
