import {useCallback, useSyncExternalStore, type SetStateAction} from 'react';

import {sessionStorageWrapper} from 'sentry/utils/sessionStorage';

// Session-storage backed `runId` store. `useSessionStorage` keeps each hook
// instance's state local, so when `useSeerExplorer` (inside the drawer) and
// `SeerExplorerContextProvider` (driving the nav button's `sessionState`)
// subscribe to the same key, writes from one don't re-render the other.
//
// This hook routes both subscribers through a single module-level store, so
// switching runs in the drawer immediately updates the nav button indicator.

const KEY = 'seer-explorer-run-id';

const listeners = new Set<() => void>();

let cachedRaw: string | null | undefined;
let cachedValue: number | null = null;

function readFromStorage(): number | null {
  const raw = sessionStorageWrapper.getItem(KEY);
  if (cachedRaw === raw) {
    return cachedValue;
  }
  cachedRaw = raw;
  if (raw === null || raw === 'undefined') {
    cachedValue = null;
  } else {
    try {
      const parsed = JSON.parse(raw);
      cachedValue = typeof parsed === 'number' ? parsed : null;
    } catch {
      cachedValue = null;
    }
  }
  return cachedValue;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  cachedRaw = undefined;
  listeners.forEach(l => l());
}

function getServerSnapshot(): number | null {
  return null;
}

export function useSeerExplorerRunId(): [
  number | null,
  (value: SetStateAction<number | null>) => void,
] {
  const runId = useSyncExternalStore(subscribe, readFromStorage, getServerSnapshot);

  const setRunId = useCallback((valueOrUpdater: SetStateAction<number | null>) => {
    const prev = readFromStorage();
    const next =
      typeof valueOrUpdater === 'function'
        ? (valueOrUpdater as (prev: number | null) => number | null)(prev)
        : valueOrUpdater;
    try {
      if (next === null) {
        sessionStorageWrapper.removeItem(KEY);
      } else {
        sessionStorageWrapper.setItem(KEY, JSON.stringify(next));
      }
    } catch {
      // Best effort.
    }
    notify();
  }, []);

  return [runId, setRunId];
}
