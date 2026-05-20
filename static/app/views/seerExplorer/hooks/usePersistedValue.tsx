import {useCallback, useEffect, useRef, useState} from 'react';

import {sessionStorageWrapper} from 'sentry/utils/sessionStorage';

function readValue(key: string): string {
  return sessionStorageWrapper.getItem(key) ?? '';
}

function writeValue(key: string, value: string): void {
  try {
    sessionStorageWrapper.setItem(key, value);
  } catch {
    // best effort
  }
}

/**
 * Persists a string value (e.g. a textarea draft) to sessionStorage, scoped by
 * `scopeId`. Unlike `useSessionStorage`, writes are deferred — storage is only
 * touched on:
 *   - scope change (flush old key, load new key)
 *   - unmount (flush current key)
 *   - explicit `clear()` (drop the persisted value and reset state to '')
 */
export function usePersistedValue(
  scope: string,
  scopeId: string | number | null | undefined
) {
  const key = `${scope}:${scopeId ?? 'null'}`;
  const [value, setValue] = useState(() => readValue(key));

  const valueRef = useRef(value);
  valueRef.current = value;

  // Flush to storage and update value on key change
  const keyRef = useRef(key);
  useEffect(() => {
    if (keyRef.current !== key) {
      writeValue(keyRef.current, valueRef.current);
      setValue(readValue(key));
      keyRef.current = key;
    }
  }, [key]);

  // Flush to storage on unmount
  useEffect(() => {
    return () => {
      writeValue(keyRef.current, valueRef.current);
    };
  }, []);

  const clear = useCallback(() => {
    setValue('');
    sessionStorageWrapper.removeItem(keyRef.current);
  }, []);

  return {value, setValue, clear};
}
