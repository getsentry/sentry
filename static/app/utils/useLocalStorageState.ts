import {useCallback, useLayoutEffect, useState} from 'react';

const SUPPORTS_QUEUE_MICROTASK = window && 'queueMicrotask' in window;
const SUPPORTS_LOCAL_STORAGE = window && 'localStorage' in window;

function scheduleMicroTask(callback: () => void) {
  if (SUPPORTS_QUEUE_MICROTASK) {
    window.queueMicrotask(callback);
  } else {
    Promise.resolve()
      .then(callback)
      .catch(e => {
        // Escape the promise and throw the error so it gets reported
        if (window && 'setTimeout' in window) {
          window.setTimeout(() => {
            throw e;
          });
        } else {
          // Best effort and just rethrow
          throw e;
        }
      });
  }
}

// Attempt to parse JSON. If it fails, swallow the error and return null.
// As an improvement, we should maybe allow users to intercept here or possibly use
// a different parsing function from JSON.parse
function tryParseStorage<T>(jsonEncodedValue: string): T | null {
  try {
    return JSON.parse(jsonEncodedValue);
  } catch (e) {
    return null;
  }
}

function defaultOrInitializer<S>(
  defaultValueOrInitializeFn: S | ((rawStorageValue?: unknown) => S),
  rawStorageValue?: unknown
): S {
  if (typeof defaultValueOrInitializeFn === 'function') {
    // https://github.com/microsoft/TypeScript/issues/37663#issuecomment-759728342
    // @ts-expect-error
    return defaultValueOrInitializeFn(rawStorageValue);
  }
  return defaultValueOrInitializeFn;
}

// Initialize state with default value or value from localStorage.
// If window is not defined uses the default value and **does not** throw an error
function initializeStorage<S>(
  key: string,
  defaultValueOrInitializeFn: S | ((rawStorageValue?: unknown) => S)
): S {
  if (typeof key !== 'string') {
    throw new TypeError('useLocalStorage: key must be a string');
  }

  // Return default if env does not support localStorage
  if (!SUPPORTS_LOCAL_STORAGE) {
    return defaultOrInitializer(defaultValueOrInitializeFn, undefined);
  }

  // getItem and try and decode it, if null is returned use default initializer
  const jsonEncodedValue = localStorage.getItem(key);
  if (jsonEncodedValue === null) {
    return defaultOrInitializer(defaultValueOrInitializeFn, null);
  }

  // We may have failed to parse the value, so just pass it down raw to the initializer
  const decodedValue = tryParseStorage<S>(jsonEncodedValue);
  if (decodedValue === null) {
    return defaultOrInitializer(defaultValueOrInitializeFn, jsonEncodedValue);
  }

  // We managed to decode the value, so use it
  return decodedValue;
}

export function useLocalStorageState<S>(
  key: string,
  initialState: S | ((rawStorageValue?: unknown) => S)
): [S, (value: S) => void] {
  const [value, setValue] = useState(() => initializeStorage<S>(key, initialState));

  // We want to avoid a blinking state with the old value when props change, so we reinitialize the state
  // before the screen updates using useLayoutEffect vs useEffect.
  useLayoutEffect(() => {
    setValue(initializeStorage(key, initialState));

    // We only want to update the value when the key changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const setStoredValue = useCallback(
    (newValue: S) => {
      if (typeof key !== 'string') {
        throw new TypeError('useLocalStorage: key must be a string');
      }

      setValue(newValue);

      // Not critical and we dont want to block anything after this
      scheduleMicroTask(() => {
        window.localStorage.setItem(key, JSON.stringify(newValue));
      });
    },
    [key]
  );

  return [value, setStoredValue];
}
