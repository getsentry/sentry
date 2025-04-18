import * as Sentry from '@sentry/react';

import localStorage from 'sentry/utils/localStorage';
import type {SourceSuggestion} from 'sentry/views/settings/components/dataScrubbing/types';

const ADVANCED_DATA_SCRUBBING_LOCALSTORAGE_KEY = 'advanced-data-scrubbing';

type StorageValue = {
  eventId: string;
  sourceSuggestions: SourceSuggestion[];
};

// TODO(Priscila): add the method below in app/utils
function fetchFromStorage(): StorageValue | undefined {
  const storage = localStorage.getItem(ADVANCED_DATA_SCRUBBING_LOCALSTORAGE_KEY);
  if (!storage) {
    return undefined;
  }

  try {
    return JSON.parse(storage);
  } catch (err) {
    Sentry.withScope(scope => {
      scope.setExtra('storage', storage);
      Sentry.captureException(err);
    });
    return undefined;
  }
}

function saveToStorage(obj: StorageValue) {
  try {
    localStorage.setItem(ADVANCED_DATA_SCRUBBING_LOCALSTORAGE_KEY, JSON.stringify(obj));
  } catch (err) {
    Sentry.captureException(err);
    Sentry.withScope(scope => {
      scope.setExtra('storage', obj);

      Sentry.captureException(err);
    });
  }
}

export {fetchFromStorage, saveToStorage};
