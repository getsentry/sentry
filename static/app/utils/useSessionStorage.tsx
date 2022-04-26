import {Dispatch, SetStateAction, useEffect, useState} from 'react';

const isBrowser = typeof window !== 'undefined';

function useSessionStorage<T>(
  key: string,
  initialValue?: T
): [T | undefined, Dispatch<SetStateAction<T | undefined>>, () => void] {
  const [state, setState] = useState<T | undefined>(() => {
    try {
      // Get from session storage by key
      const sessionStorageValue = sessionStorage.getItem(key);

      if (sessionStorageValue === 'undefined') {
        return initialValue;
      }

      // Parse stored json or if none return initialValue
      return sessionStorageValue ? JSON.parse(sessionStorageValue) : initialValue;
    } catch {
      // If user is in private mode or has storage restriction
      // sessionStorage can throw. JSON.parse and JSON.stringify
      // can throw, too.
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      const serializedState = JSON.stringify(state);
      sessionStorage.setItem(key, serializedState);
    } catch {
      // If user is in private mode or has storage restriction
      // sessionStorage can throw. Also JSON.stringify can throw.
    }
  }, [state]);

  function removeItem() {
    sessionStorage.removeItem(key);
    setState(undefined);
  }

  if (!isBrowser) {
    return [initialValue, () => {}, () => {}];
  }

  return [state, setState, removeItem];
}

export default useSessionStorage;
