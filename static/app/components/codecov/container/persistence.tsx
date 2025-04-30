import {captureException} from '@sentry/react';

import type {CodecovContextTypes} from 'sentry/components/codecov/container/container';

// Constants
const CODECOV_PRODUCT = 'codecov';

// Types
type CodecovObjectInLocalStorage = {
  repository: string | null;
};

// Functions
/**
 * Creates Codecov product local storage key signature
 */
function makeCodecovLocalStorageKey(orgSlug: string) {
  return `${CODECOV_PRODUCT}-selection:${orgSlug}`;
}

/**
 * Retrieves Codecov data from local storage. It:
 * 1) Gets data from local storage with the Codecov key.
 * 2) Attempts to parse the data.
 * 3) Validates and returns the data.
 */
export function getCodecovDataFromLocalStorage(
  orgSlug: string
): CodecovObjectInLocalStorage | null {
  // 1)
  const localStorageKey = makeCodecovLocalStorageKey(orgSlug);

  const value = localStorage.getItem(localStorageKey);

  if (!value) {
    return null;
  }

  let decoded: CodecovObjectInLocalStorage;

  // 2)
  try {
    decoded = JSON.parse(value);
  } catch (err) {
    captureException(err);
    return null;
  }

  // 3)
  const {repository} = decoded;

  return {repository};
}

/**
 * Sets Codecov data local local storage. It:
 * 1) Gets data currently in local storage.
 * 2) Populates each field to be stored.
 * 3) Attempts to store the data in local storage.
 */
export function setCodecovDataToLocalStorage(
  orgSlug: string,
  newState: CodecovContextTypes
) {
  // 1)
  const codecovDataFromStorage = getCodecovDataFromLocalStorage(orgSlug);

  // 2)
  const repository = newState.repository
    ? newState.repository
    : codecovDataFromStorage?.repository || null;

  const dataToSave: CodecovObjectInLocalStorage = {
    repository,
  };

  // 3)
  try {
    localStorage.setItem(makeCodecovLocalStorageKey(orgSlug), JSON.stringify(dataToSave));
  } catch (ex) {
    // Do nothing
  }
}
