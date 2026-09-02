import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';

/**
 * Sentry-employee-only toggle for running autofix with bash tools. Shared so
 * that starting a run from the drawer or from the start card both respect it.
 */
export function useForceBashMode() {
  return useSyncedLocalStorageState<boolean>('autofix-force-bash-mode', false);
}
