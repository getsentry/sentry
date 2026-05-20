import {useCallback, useEffect, useRef, useState} from 'react';

import {sessionStorageWrapper} from 'sentry/utils/sessionStorage';

function readValue(key: string | null): string {
  if (key === null) {
    return '';
  }
  return sessionStorageWrapper.getItem(key) ?? '';
}

function writeValue(key: string | null, value: string): void {
  if (key === null) {
    return;
  }
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
 *
 * When `scopeId` is null the value lives in React state only — no
 * sessionStorage reads or writes happen for that scope.
 */
export function usePersistedValue(
  scope: string,
  scopeId: string | number | null | undefined
) {
  const key = scopeId === null ? null : `${scope}:${scopeId}`;
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
    if (keyRef.current !== null) {
      sessionStorageWrapper.removeItem(keyRef.current);
    }
  }, []);

  return {value, setValue, clear};
}
