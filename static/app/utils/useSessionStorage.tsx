import {useCallback, useEffect, useState, type SetStateAction} from 'react';

import {sessionStorageWrapper} from 'sentry/utils/sessionStorage';

const isBrowser = typeof window !== 'undefined';

export function readStorageValue<T>(key: string, initialValue: T) {
  const value = sessionStorageWrapper.getItem(key);

  // We check for 'undefined' because the value may have
  // previously been serialized as 'undefined'. This should no longer
  // happen, but want to handle it gracefully.
  if (value === null || value === 'undefined') {
    return initialValue;
  }

  // Try parse storage value.
  try {
    return JSON.parse(value);
  } catch {
    // If parsing fails, return initial value.
    return initialValue;
  }
}

export function useSessionStorage<T>(
  key: string,
  initialValue: T
): [T, (value: SetStateAction<T>) => void, () => void] {
  const [state, setState] = useState<T>(() => readStorageValue(key, initialValue));

  useEffect(() => {
    setState(readStorageValue(key, initialValue));
    // We want to re-initialized the storage value only when the key changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const wrappedSetState = useCallback(
    (valueOrUpdater: SetStateAction<T>) => {
      setState(prev => {
        const next =
          typeof valueOrUpdater === 'function'
            ? (valueOrUpdater as (prev: T) => T)(prev)
            : valueOrUpdater;

        try {
          sessionStorageWrapper.setItem(key, JSON.stringify(next));
        } catch {
          // Best effort and just update the in-memory value.
        }

        return next;
      });
    },
    [key]
  );

  const removeItem = useCallback(() => {
    setState(initialValue);
    sessionStorageWrapper.removeItem(key);
  }, [key, initialValue]);

  if (!isBrowser) {
    return [initialValue, () => {}, () => {}];
  }

  return [state, wrappedSetState, removeItem];
}
