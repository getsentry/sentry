import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import type {
  EventId,
  SourceSuggestion,
} from 'sentry/views/settings/components/dataScrubbing/types';
import {EventIdStatus} from 'sentry/views/settings/components/dataScrubbing/types';
import {valueSuggestions} from 'sentry/views/settings/components/dataScrubbing/utils';

const ADVANCED_DATA_SCRUBBING_LOCALSTORAGE_KEY = 'advanced-data-scrubbing';

type StorageValue = {
  eventId: string;
  sourceSuggestions: SourceSuggestion[];
};

export function useSourceGroupData() {
  const [sourceGroupData, setSourceGroupData] = useLocalStorageState<StorageValue>(
    ADVANCED_DATA_SCRUBBING_LOCALSTORAGE_KEY,
    {
      eventId: '',
      sourceSuggestions: valueSuggestions,
    }
  );

  const saveToSourceGroupData = (
    eventId: EventId,
    sourceSuggestions = valueSuggestions
  ) => {
    switch (eventId.status) {
      case EventIdStatus.LOADING:
        break;
      case EventIdStatus.LOADED:
        setSourceGroupData({eventId: eventId.value, sourceSuggestions});
        break;
      default:
        setSourceGroupData({eventId: '', sourceSuggestions});
    }
  };

  return {
    sourceGroupData,
    saveToSourceGroupData,
  };
}

export function hasCaptureGroups(pattern: string) {
  const m = pattern.match(/\(.*\)/);
  return m !== null && m.length > 0;
}
