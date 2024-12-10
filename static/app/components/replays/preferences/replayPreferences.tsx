import localStorage from 'sentry/utils/localStorage';

const LOCAL_STORAGE_KEY = 'replay-config';

export type ReplayPrefs = {
  isSkippingInactive: boolean;
  playbackSpeed: number;
  timestampType: 'relative' | 'absolute';
};

const CAN_SKIP_PREFS: ReplayPrefs = {
  isSkippingInactive: true,
  playbackSpeed: 1,
  timestampType: 'relative',
};

const NO_SKIP_PREFS: ReplayPrefs = {
  isSkippingInactive: false,
  playbackSpeed: 1,
  timestampType: 'relative',
};

export interface PrefsStrategy {
  _prefs: ReplayPrefs;
  get: () => ReplayPrefs;
  set: (prefs: ReplayPrefs) => void;
}

export const StaticReplayPreferences: PrefsStrategy = {
  _prefs: {...CAN_SKIP_PREFS},
  get() {
    return this._prefs;
  },
  set(prefs) {
    this._prefs = prefs;
  },
};

export const StaticNoSkipReplayPreferences: PrefsStrategy = {
  _prefs: {...NO_SKIP_PREFS},
  get() {
    return this._prefs;
  },
  set(prefs) {
    this._prefs = prefs;
  },
};

export const LocalStorageReplayPreferences: PrefsStrategy = {
  _prefs: {...CAN_SKIP_PREFS},
  get() {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}');
    return {...CAN_SKIP_PREFS, ...parsed};
  },
  set(prefs) {
    this._prefs = prefs;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(prefs));
  },
};
