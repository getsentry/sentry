import {useEffect} from 'react';
import {parseAsString, useQueryState, type Parser} from 'nuqs';

import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';

/**
 * Hook that syncs state between URL query parameters and localStorage.
 * URL takes precedence over localStorage, enabling URL sharing while
 * maintaining user preferences across sessions.
 *
 * Supports any data type via Nuqs parsers (parseAsString, parseAsInteger,
 * parseAsBoolean, parseAsArrayOf, etc.). The parser handles URL serialization
 * while localStorage uses JSON for storage.
 *
 * @param props - Configuration object
 * @param props.key - The URL query parameter name
 * @param props.namespace - The localStorage namespace (key will be `namespace:key`)
 * @param props.defaultValue - The default value if neither source has a value
 * @param props.parser - Nuqs parser for the value type (defaults to parseAsString)
 * @returns Tuple of [effectiveValue, setValue]
 *
 * @example
 * // String values (parser optional, defaults to parseAsString)
 * const [sortBy, setSortBy] = useQueryStateWithLocalStorage({
 *   key: 'sortBy',
 *   namespace: 'dashboards',
 *   defaultValue: 'date',
 * });
 *
 * @example
 * // Integer values
 * const [pageSize, setPageSize] = useQueryStateWithLocalStorage({
 *   key: 'pageSize',
 *   namespace: 'dashboards',
 *   defaultValue: 50,
 *   parser: parseAsInteger,
 * });
 *
 * @example
 * // Boolean values
 * const [enabled, setEnabled] = useQueryStateWithLocalStorage({
 *   key: 'enabled',
 *   namespace: 'dashboards',
 *   defaultValue: false,
 *   parser: parseAsBoolean,
 * });
 */
export function useQueryStateWithLocalStorage<T>({
  key,
  namespace,
  defaultValue,
  parser = parseAsString as Parser<T>,
}: {
  defaultValue: T;
  key: string;
  namespace: string;
  parser?: Parser<T>;
}): [T, (value: T) => void] {
  const [urlValue, setUrlValue] = useQueryState(key, parser);

  const localStorageKey = `${namespace}:${key}`;

  const [localStorageValue, setLocalStorageValue] = useLocalStorageState<T>(
    localStorageKey,
    defaultValue
  );

  const effectiveValue = urlValue ?? localStorageValue ?? defaultValue;

  useEffect(() => {
    if (urlValue !== null && urlValue !== undefined && urlValue !== localStorageValue) {
      setLocalStorageValue(urlValue);
    }
  }, [urlValue, localStorageValue, setLocalStorageValue]);

  const setValue = (value: T) => {
    setUrlValue(value);
    setLocalStorageValue(value);
  };

  return [effectiveValue, setValue];
}
