import {useCallback, useEffect, useRef, useState} from 'react';

import {
  readStorageValue,
  writeStorageValue,
  removeStorageValue,
} from 'sentry/utils/useSessionStorage';

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
  const [value, setValue] = useState(() => readStorageValue(key, initialValue));

  const keyRef = useRef(key);
  const valueRef = useRef(value);
  valueRef.current = value;

  // Flush to storage and update value on key change
  useEffect(() => {
    if (keyRef.current !== key) {
      writeStorageValue(keyRef.current, valueRef.current);
      setValue(readStorageValue(key, initialValue));
      keyRef.current = key;
    }
  }, [key, initialValue]);

  // Flush to storage on unmount
  useEffect(() => {
    return () => {
      writeStorageValue(keyRef.current, valueRef.current);
    };
  }, []);

  const reset = useCallback(() => {
    setValue(() => {
      removeStorageValue(keyRef.current);
      return initialValue;
    });
  }, [initialValue]);

  return {value, setValue, reset};
}
