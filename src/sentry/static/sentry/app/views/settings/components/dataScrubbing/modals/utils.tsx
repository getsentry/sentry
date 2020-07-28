import {fetchFromStorage, saveToStorage} from './localStorage';
import {EventIdStatus, EventId} from '../types';
import {valueSuggestions} from '../utils';

function fetchSourceGroupData() {
  const fetchedSourceGroupData = fetchFromStorage();
  if (!fetchedSourceGroupData) {
    const sourceGroupData: Parameters<typeof saveToStorage>[0] = {
      eventId: '',
      sourceSuggestions: valueSuggestions,
    };
    saveToStorage(sourceGroupData);
    return sourceGroupData;
  }
  return fetchedSourceGroupData;
}

function saveToSourceGroupData(eventId: EventId, sourceSuggestions = valueSuggestions) {
  switch (eventId.status) {
    case EventIdStatus.LOADING:
      break;
    case EventIdStatus.LOADED:
      saveToStorage({eventId: eventId.value, sourceSuggestions});
      break;
    default:
      saveToStorage({eventId: '', sourceSuggestions});
  }
}

export {fetchSourceGroupData, saveToSourceGroupData};
