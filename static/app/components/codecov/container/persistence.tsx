import {captureException} from '@sentry/react';

// Constants
const CODECOV_PRODUCT = 'codecov';

// Types
export type CodecovObjectInLocalStorage = {
  repository: string | null;
};

// Functions
/**
 * Creates Codecov product local storage key signature
 */
export function makeCodecovLocalStorageKey(orgSlug: string) {
  return `${CODECOV_PRODUCT}-selection:${orgSlug}`;
}

/**
 * Retrieves data from local storage, returning a generically typed response. It:
 * 1) Gets data from local storage with the provided key.
 * 2) Attempts to parse the data.
 * 3) Returns the data.
 */
export function getDataFromLocalStorage<T>(localStorageKey: string): T | null {
  const value = localStorage.getItem(localStorageKey);

  if (!value) {
    return null;
  }

  let decoded: T;

  try {
    decoded = JSON.parse(value);
  } catch (err) {
    captureException(err);
    return null;
  }

  return {...decoded};
}

/**
 * Sets generic data to local storage. It:
 * 1) Gets data currently in local storage.
 * 2) Populates each field to be stored.
 * 3) Attempts to store the data in local storage.
 * This function assumes the default value is null, but it can be extended to determine
 * default values based on the stored type.
 */
export function setDataToLocalStorage<T extends Record<string, string | null>>(
  localStorageKey: string,
  newState: T
): void {
  const dataFromStorage = getDataFromLocalStorage<T>(localStorageKey);
  if (dataFromStorage === null) {
    _attempt_to_store<T>(localStorageKey, newState);
    return;
  }
  const dataToStore = {} as T;

  for (const key in newState) {
    const keyTyped = key as keyof T;

    dataToStore[keyTyped] = newState[keyTyped]
      ? newState[keyTyped]
      : (dataFromStorage[keyTyped] ?? (null as T[keyof T]));
  }

  _attempt_to_store<T>(localStorageKey, dataToStore);
}

function _attempt_to_store<T extends Record<string, string | null>>(
  key: string,
  data: T
) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    // do nothing
  }
}
