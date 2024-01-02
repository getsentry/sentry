import {type Event as TEvent, EventOrGroupType, EventTransaction} from 'sentry/types';

export function Event(params = {}): TEvent {
  return {
    id: '1',
    message: 'ApiException',
    title: 'ApiException',
    metadata: {},
    entries: [],
    projectID: '1',
    groupID: '1',
    eventID: '12345678901234567890123456789012',
    dateCreated: '2019-05-21T18:01:48.762Z',
    dateReceived: '2019-05-21T18:01:48.762Z',
    tags: [],
    errors: [],
    crashFile: null,
    size: 0,
    dist: null,
    fingerprints: [],
    culprit: '',
    user: null,
    location: '',
    type: EventOrGroupType.ERROR,
    occurrence: null,
    resolvedWith: [],
    contexts: {},
    ...params,
  };
}

export function TransactionEvent(
  params: Partial<EventTransaction> = {}
): EventTransaction {
  return {
    type: EventOrGroupType.TRANSACTION,
    id: '1',
    message: '',
    crashFile: null,
    culprit: '',
    dateCreated: '2023-12-28T15:58:48.762Z',
    dist: '',
    errors: [],
    occurrence: null,
    dateReceived: '2023-12-28T15:58:48.762Z',
    size: 0,
    user: null,
    title: '',
    metadata: {},
    entries: [],
    projectID: '1',
    groupID: '1',
    eventID: '47829ecde95d42ac843f24592b7b7e46',
    tags: [],
    endTimestamp: 1703779100,
    startTimestamp: 1703779101,
    fingerprints: [],
    location: '',
    contexts: {},
    ...params,
  };
}
