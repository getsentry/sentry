import {useCallback, useEffect, useRef, useState} from 'react';

import {sessionStorageWrapper} from 'sentry/utils/sessionStorage';
import {readStorageValue, writeStorageValue} from 'sentry/utils/useSessionStorage';

function readValue<T>(key: string | null, initialValue: T): T {
  if (key === null) {
    return initialValue;
  }
  return readStorageValue(key, initialValue);
}

function writeValue(key: string | null, value: unknown): void {
  if (key === null) {
    return;
  }
  writeStorageValue(key, value);
}

/**
 * Persists a value to sessionStorage under `key`. Unlike `useSessionStorage`, writes are deferred —
 * storage is only updated on:
 *   - key change (flush old key, load new key)
 *   - unmount (flush current key)
 *   - explicit `reset()` (drop the persisted value and reset state to initialValue)
 *
 * When `key` is null the storage persistence is disabled - the value lives in React state only.
 */
export function useDeferredSessionStorage<T>(key: string | null, initialValue: T) {
  const [value, setValue] = useState(() => readValue(key, initialValue));

  const keyRef = useRef(key);
  const valueRef = useRef(value);
  valueRef.current = value;

  // Flush to storage and update value on key change
  useEffect(() => {
    if (keyRef.current !== key) {
      writeValue(keyRef.current, valueRef.current);
      setValue(readValue(key, initialValue));
      keyRef.current = key;
    }
  }, [key, initialValue]);

  // Flush to storage on unmount
  useEffect(() => {
    return () => {
      writeValue(keyRef.current, valueRef.current);
    };
  }, []);

  const reset = useCallback(() => {
    if (keyRef.current !== null) {
      sessionStorageWrapper.removeItem(keyRef.current);
    }
    setValue(initialValue);
  }, [initialValue]);

  return {value, setValue, reset};
}
