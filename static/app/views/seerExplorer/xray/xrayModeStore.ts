import {useSyncExternalStore} from 'react';

import {localStorageWrapper} from 'sentry/utils/localStorage';

/**
 * Seer XRay Mode — on/off state.
 *
 * A minimal module-level store (not Reflux) so the cmd+K toggle action and
 * the overlay, which live in unrelated parts of the tree, can share one flag
 * without a dedicated context provider. Persisted to localStorage so the
 * mode survives a page reload.
 */

const STORAGE_KEY = 'seer-xray-mode-enabled';

const listeners = new Set<() => void>();

let enabled = localStorageWrapper.getItem(STORAGE_KEY) === '1';

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

function getSnapshot() {
  return enabled;
}

export function setXRayModeEnabled(next: boolean): void {
  if (next === enabled) {
    return;
  }
  enabled = next;
  localStorageWrapper.setItem(STORAGE_KEY, enabled ? '1' : '0');
  emitChange();
}

export function toggleXRayMode(): void {
  setXRayModeEnabled(!enabled);
}

export function useXRayModeEnabled(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot);
}
