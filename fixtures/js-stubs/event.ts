import {Event as TEvent, EventOrGroupType} from 'sentry/types';

export function Event(params = {}): TEvent {
  return {
    id: '1',
    message: 'ApiException',
    title: 'ApiException',
    metadata: {
      type: 'ApiException',
      value: '',
    },
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
    user: {ip_address: '127.0.0.1', email: 'billy@sentry.io', id: '1'},
    location: '',
    type: EventOrGroupType.ERROR,
    occurrence: null,
    contexts: {
      os: {
        version: '10.12.5',
        type: 'os',
        name: 'Mac OS X',
        build: '',
        kernel_version: '',
      },
      browser: {version: '59.0.3071', name: 'Chrome'},
    },
    ...params,
  };
}
