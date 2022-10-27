import {useCallback, useEffect} from 'react';

import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';

type SyncedLocalStorageEvent = CustomEvent<{key: string; value: any}>;

const SET_VALUE_EVENT_NAME = 'synced-local-storage';

/**
 * Same as `useLocalStorageState`, but notifies and reacts to state changes.
 * Use this you want to access local storage state from multiple components
 * on the same page.
 */
export function useSyncedLocalStorageState<S>(
  key: string,
  initialState: S | ((value?: unknown, rawValue?: unknown) => S)
): [S, (value: S) => void] {
  const [value, setValue] = useLocalStorageState(key, initialState);

  const setValueAndNotify = useCallback(
    newValue => {
      setValue(newValue);

      // We use a custom event to notify all consumers of this hook
      window.dispatchEvent(
        new CustomEvent(SET_VALUE_EVENT_NAME, {detail: {key, value: newValue}})
      );
    },
    [key, setValue]
  );

  useEffect(() => {
    const handleNewSyncedLocalStorageEvent = (event: Event) => {
      const eventDetail = (event as SyncedLocalStorageEvent).detail;

      if (eventDetail && eventDetail.key === key) {
        setValue(eventDetail.value);
      }
    };

    window.addEventListener(SET_VALUE_EVENT_NAME, handleNewSyncedLocalStorageEvent);

    return () => {
      window.removeEventListener(SET_VALUE_EVENT_NAME, handleNewSyncedLocalStorageEvent);
    };
  }, [key, setValue, value]);

  return [value, setValueAndNotify];
}
