import localStorage from 'sentry/utils/localStorage';

const LOCAL_STORAGE_KEY = 'replay-config';

export type ReplayPrefs = {
  isSkippingInactive: boolean;
  playbackSpeed: number;
};

const DEFAULT_PREFS = {
  isSkippingInactive: true,
  playbackSpeed: 1,
};

export interface PrefsStrategy {
  get: () => ReplayPrefs;
  set: (prefs: ReplayPrefs) => void;
}

export function StaticReplayPreferences(): PrefsStrategy {
  return {
    get: (): ReplayPrefs => DEFAULT_PREFS,
    set: () => {},
  };
}

export function LocalStorageReplayPreferences(): PrefsStrategy {
  return {
    get: (): ReplayPrefs => {
      const parsed = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}');
      return {...DEFAULT_PREFS, ...parsed};
    },
    set: (prefs: ReplayPrefs) =>
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(prefs)),
  };
}
