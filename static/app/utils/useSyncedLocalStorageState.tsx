import {useCallback, useEffect} from 'react';

import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';

type SyncedLocalStorageEvent<S> = CustomEvent<{key: string; value: S}>;

const SYNCED_STORAGE_EVENT = 'synced-local-storage';

function isCustomEvent(event: Event): event is CustomEvent {
  return 'detail' in event;
}

function isSyncedLocalStorageEvent<S>(
  event: Event,
  key: string
): event is SyncedLocalStorageEvent<S> {
  return (
    isCustomEvent(event) &&
    event.type === SYNCED_STORAGE_EVENT &&
    event.detail.key === key
  );
}

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
    (newValue: any) => {
      setValue(newValue);

      // We use a custom event to notify all consumers of this hook
      window.dispatchEvent(
        new CustomEvent(SYNCED_STORAGE_EVENT, {detail: {key, value: newValue}})
      );
    },
    [key, setValue]
  );

  useEffect(() => {
    const handleNewSyncedLocalStorageEvent = (event: Event) => {
      if (isSyncedLocalStorageEvent<S>(event, key)) {
        setValue(event.detail.value);
      }
    };

    window.addEventListener(SYNCED_STORAGE_EVENT, handleNewSyncedLocalStorageEvent);

    return () => {
      window.removeEventListener(SYNCED_STORAGE_EVENT, handleNewSyncedLocalStorageEvent);
    };
  }, [key, setValue, value]);

  return [value, setValueAndNotify];
}
