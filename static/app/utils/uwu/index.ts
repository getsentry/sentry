import {localStorageWrapper} from 'sentry/utils/localStorage';

export {uwuify} from './transform';

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

export function toggleUwu() {
  const next = localStorageWrapper.getItem(UWU_STORAGE_KEY) !== '1';
  localStorageWrapper.setItem(UWU_STORAGE_KEY, next ? '1' : '0');
  window.location.reload();
}
