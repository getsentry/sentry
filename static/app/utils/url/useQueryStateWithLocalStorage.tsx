import {useEffect} from 'react';
import {parseAsString, useQueryState} from 'nuqs';

import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';

/**
 * Hook that syncs state between URL query parameters and localStorage.
 * URL takes precedence over localStorage, enabling URL sharing while
 * maintaining user preferences across sessions.
 *
 * @param props - Configuration object
 * @param props.key - The URL query parameter name
 * @param props.namespace - The localStorage namespace (key will be `namespace:key`)
 * @param props.defaultValue - The default value if neither source has a value
 * @returns Tuple of [effectiveValue, setValue]
 *
 * @example
 * const [sortBy, setSortBy] = useQueryStateWithLocalStorage({
 *   key: 'sortBy',
 *   namespace: 'dashboards',
 *   defaultValue: 'date',
 * });
 */
export function useQueryStateWithLocalStorage<T extends string>({
  key,
  namespace,
  defaultValue,
}: {
  defaultValue: T;
  key: string;
  namespace: string;
}): [T, (value: T) => void] {
  const [urlValue, setUrlValue] = useQueryState(key, parseAsString);

  const localStorageKey = `${namespace}:${key}`;

  const [localStorageValue, setLocalStorageValue] = useLocalStorageState<T>(
    localStorageKey,
    defaultValue
  );

  const effectiveValue = (urlValue ?? localStorageValue ?? defaultValue) as T;

  useEffect(() => {
    if (urlValue && urlValue !== localStorageValue) {
      setLocalStorageValue(urlValue as T);
    }
  }, [urlValue, localStorageValue, setLocalStorageValue]);

  const setValue = (value: T) => {
    setUrlValue(value);
    setLocalStorageValue(value);
  };

  return [effectiveValue, setValue];
}
