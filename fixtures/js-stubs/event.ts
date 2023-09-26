import {type Event as TEvent, EventOrGroupType} from 'sentry/types';

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
