import {useEffect, useSyncExternalStore, type ReactNode} from 'react';

import {useOrganization} from 'sentry/utils/useOrganization';

const SKIP_CACHE_FEATURE = 'dashboards-timeseries-skip-cache';

// The widget viewer modal renders outside the dashboard page, so both read
// this store. The provider clears it when the dashboard unmounts.
let skipCacheEnabled = false;
const listeners = new Set<() => void>();

function emitSkipCache() {
  for (const listener of listeners) {
    listener();
  }
}

export function setDashboardSkipCache(next: boolean) {
  if (next === skipCacheEnabled) {
    return;
  }
  skipCacheEnabled = next;
  emitSkipCache();
}

function subscribeToSkipCache(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSkipCacheSnapshot() {
  return skipCacheEnabled;
}

export function DashboardSkipCacheProvider({children}: {children: ReactNode}) {
  useEffect(() => () => setDashboardSkipCache(false), []);
  return children;
}

export function useDashboardSkipCache() {
  const enabled = useSyncExternalStore(
    subscribeToSkipCache,
    getSkipCacheSnapshot,
    getSkipCacheSnapshot
  );
  return {skipCache: enabled, setSkipCache: setDashboardSkipCache};
}

export function useShouldSkipTimeseriesCache() {
  const organization = useOrganization();
  const {skipCache} = useDashboardSkipCache();
  return skipCache && organization.features.includes(SKIP_CACHE_FEATURE);
}
