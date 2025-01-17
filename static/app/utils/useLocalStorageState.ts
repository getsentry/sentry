import {useCallback, useLayoutEffect, useRef, useState} from 'react';

import localStorageWrapper from 'sentry/utils/localStorage';

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
        if (window) {
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

function makeTypeExceptionString(instance: string) {
  return `useLocalStorage: Native serialization of ${instance} is not supported. You are attempting to serialize a ${instance} instance, this data will be lost. For more info, see how ${instance.toLowerCase()}s are serialized https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#examples`;
}

function strictReplacer<T>(_key: string, value: T): T {
  if (typeof BigInt !== 'undefined' && typeof value === 'bigint') {
    throw new TypeError(makeTypeExceptionString('BigInt'));
  }
  if (value instanceof RegExp) {
    throw new TypeError(makeTypeExceptionString('RegExp'));
  }
  if (typeof Map !== 'undefined' && value instanceof Map) {
    throw new TypeError(makeTypeExceptionString('Map'));
  }
  if (typeof Set !== 'undefined' && value instanceof Set) {
    throw new TypeError(makeTypeExceptionString('Set'));
  }
  if (typeof WeakMap !== 'undefined' && value instanceof WeakMap) {
    throw new TypeError(makeTypeExceptionString('WeakMap'));
  }
  if (typeof WeakSet !== 'undefined' && value instanceof WeakSet) {
    throw new TypeError(makeTypeExceptionString('WeakSet'));
  }
  return value;
}

function stringifyForStorage(value: unknown) {
  return JSON.stringify(value, strictReplacer, 0);
}

function defaultOrInitializer<S>(
  defaultValueOrInitializeFn: S | ((value?: unknown, rawStorageValue?: unknown) => S),
  value?: unknown,
  rawValue?: unknown
): S {
  if (typeof defaultValueOrInitializeFn === 'function') {
    // https://github.com/microsoft/TypeScript/issues/37663#issuecomment-759728342
    // @ts-ignore TS(2349): This expression is not callable.
    return defaultValueOrInitializeFn(value, rawValue);
  }
  return value === undefined ? defaultValueOrInitializeFn : (value as S);
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

  // Return default if env does not support localStorage. Passing null to initializer
  // to mimick not having any previously stored value there.
  if (!SUPPORTS_LOCAL_STORAGE) {
    return defaultOrInitializer(defaultValueOrInitializeFn, undefined, null);
  }

  // getItem and try and decode it, if null is returned use default initializer
  const jsonEncodedValue = localStorageWrapper.getItem(key);
  if (jsonEncodedValue === null) {
    return defaultOrInitializer(defaultValueOrInitializeFn, undefined, null);
  }

  // We may have failed to parse the value, so just pass it down raw to the initializer
  const decodedValue = tryParseStorage<S>(jsonEncodedValue);
  if (decodedValue === null) {
    return defaultOrInitializer(defaultValueOrInitializeFn, undefined, jsonEncodedValue);
  }

  // We managed to decode the value, so use it
  return defaultOrInitializer(defaultValueOrInitializeFn, decodedValue, jsonEncodedValue);
}

// Mimicks the behavior of React.useState but keeps state synced with localStorage.
// The only difference from React is that when a state initializer fn is passed,
// the first argument to that function will be the value that we decoded from localStorage
// and the second argument will be the raw value from localStorage. This is useful for cases where you may
// want to recover the error, apply a transformation or use an alternative parsing function.
export function useLocalStorageState<S>(
  key: string,
  initialState: S | ((value?: unknown, rawValue?: unknown) => S)
): [S, (value: S | ((prevState: S) => S)) => void] {
  const [value, setValue] = useState(() => {
    return initializeStorage<S>(key, initialState);
  });

  // We want to avoid a blinking state with the old value when props change, so we reinitialize the state
  // before the screen updates using useLayoutEffect vs useEffect. The ref prevents this from firing on mount
  // as the value will already be initialized from the initialState and it would be unnecessary to re-initialize
  const renderRef = useRef(false);
  useLayoutEffect(() => {
    if (!renderRef.current) {
      renderRef.current = true;
      return;
    }

    setValue(initializeStorage(key, initialState));
    // We only want to update the value when the key changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const setStoredValue = useCallback(
    (newValue: S | ((prevState: S) => S)) => {
      if (typeof key !== 'string') {
        throw new TypeError('useLocalStorage: key must be a string');
      }

      if (typeof newValue === 'function') {
        setValue(p => {
          // should be storing functions in state...
          // Not critical and we dont want to block anything after this, so fire microtask
          // and allow this to eventually be in sync.
          // @ts-ignore TS(2349): This expression is not callable.
          const newlyComputedValue = newValue(p);
          scheduleMicroTask(() => {
            localStorageWrapper.setItem(key, stringifyForStorage(newlyComputedValue));
          });
          return newlyComputedValue;
        });
      } else {
        setValue(newValue);
        // Not critical and we dont want to block anything after this, so fire microtask
        // and allow this to eventually be in sync.
        scheduleMicroTask(() => {
          localStorageWrapper.setItem(key, stringifyForStorage(newValue));
        });
      }
    },
    [key]
  );

  return [value, setStoredValue];
}
