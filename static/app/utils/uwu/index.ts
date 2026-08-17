import {localStorageWrapper} from 'sentry/utils/localStorage';

export {uwuify, uwuifyLeaves} from './transform';

export const UWU_LANGUAGE_CODE = 'uwu';

const UWU_STORAGE_KEY = 'uwu';

function readUwuEnabled(): boolean {
  if (localStorageWrapper.getItem(UWU_STORAGE_KEY) === '1') {
    return true;
  }

  try {
    return new URLSearchParams(window.location.search).get('lang') === UWU_LANGUAGE_CODE;
  } catch {
    return false;
  }
}

let uwuEnabled: boolean | null = null;

/**
 * Resolved lazily rather than at import time because modules call `t()` while
 * they evaluate, which happens before `initializeLocale` gets to run.
 */
export function isUwuEnabled(): boolean {
  uwuEnabled ??= readUwuEnabled();
  return uwuEnabled;
}

export function setUwuEnabled(enabled: boolean) {
  uwuEnabled = enabled;
}

/**
 * `?expand=35` targets strings 35% longer than english, matching roughly what a
 * real locale like german costs. Capped because past a point every string wraps
 * and the sweep stops telling you anything.
 */
function readUwuExpansion(): number {
  try {
    const value = new URLSearchParams(window.location.search).get('expand');
    const percent = value === null ? 0 : Number.parseFloat(value);

    return Number.isFinite(percent) ? Math.min(Math.max(percent, 0), 200) / 100 : 0;
  } catch {
    return 0;
  }
}

let uwuExpansion: number | null = null;

export function getUwuExpansion(): number {
  uwuExpansion ??= readUwuExpansion();
  return uwuExpansion;
}

export function toggleUwu() {
  const next = localStorageWrapper.getItem(UWU_STORAGE_KEY) !== '1';
  localStorageWrapper.setItem(UWU_STORAGE_KEY, next ? '1' : '0');
  window.location.reload();
}
