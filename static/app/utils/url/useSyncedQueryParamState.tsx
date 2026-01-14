import {useEffect} from 'react';
import {parseAsString, useQueryState} from 'nuqs';

import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';

/**
 * Hook that syncs state between URL query parameters and localStorage.
 * URL takes precedence over localStorage, enabling URL sharing while
 * maintaining user preferences across sessions.
 *
 * @param urlParamName - The URL query parameter name
 * @param localStorageKey - The localStorage key
 * @param defaultValue - The default value if neither source has a value
 * @returns Tuple of [effectiveValue, setValue]
 *
 * @example
 * const [sortBy, setSortBy] = useSyncedQueryParamState(
 *   'sortBy',
 *   'mySortPreference',
 *   'date'
 * );
 */
export function useSyncedQueryParamState<T extends string>(
  urlParamName: string,
  localStorageKey: string,
  defaultValue: T
): [T, (value: T) => void] {
  // localStorage provides fallback when URL is empty
  const [localStorageValue, setLocalStorageValue] = useLocalStorageState<T>(
    localStorageKey,
    defaultValue
  );

  // URL query param state (Nuqs handles URL updates)
  const [urlValue, setUrlValue] = useQueryState(
    urlParamName,
    parseAsString.withDefault(defaultValue)
  );

  // URL takes precedence over localStorage
  const effectiveValue = (urlValue || localStorageValue) as T;

  // Sync localStorage when URL changes (URL is source of truth for sharing)
  useEffect(() => {
    if (urlValue && urlValue !== localStorageValue) {
      setLocalStorageValue(urlValue as T);
    }
  }, [urlValue, localStorageValue, setLocalStorageValue]);

  // Single setter that updates both URL and localStorage
  const setValue = (value: T) => {
    setUrlValue(value);
    setLocalStorageValue(value);
  };

  return [effectiveValue, setValue];
}
