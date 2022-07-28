import {useCallback, useEffect, useState} from 'react';

import sessionStorageWrapper from 'sentry/utils/sessionStorage';

const isBrowser = typeof window !== 'undefined';

function readStorageValue<T>(key, initialValue: T) {
  const value = sessionStorage.getItem(key);

  if (value === null) {
    return initialValue;
  }

  // Try parse storage value.
  try {
    return JSON.parse(value);
  } catch (e) {
    // If parsing fails, return initial value.
    return initialValue;
  }
}

function useSessionStorage<T>(
  key: string,
  initialValue?: T
): [T | undefined, (value: T | undefined) => void, () => void] {
  const [state, setState] = useState<T | undefined>(() =>
    readStorageValue(key, initialValue)
  );

  useEffect(() => {
    setState(readStorageValue(key, initialValue));
    // We want to re-initialized the storage value only when the key changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const wrappedSetState = useCallback(
    (value: T | undefined) => {
      setState(value);

      try {
        sessionStorageWrapper.setItem(key, JSON.stringify(value));
      } catch (e) {
        // Best effort and just update the in-memory value.
      }
    },
    [key]
  );

  const removeItem = useCallback(() => {
    sessionStorageWrapper.removeItem(key);
    setState(undefined);
  }, [key]);

  if (!isBrowser) {
    return [initialValue, () => {}, () => {}];
  }

  return [state, wrappedSetState, removeItem];
}

export default useSessionStorage;
