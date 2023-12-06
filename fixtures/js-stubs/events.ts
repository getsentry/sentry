import {type Event, EventOrGroupType, EventsStats as TEventsStats} from 'sentry/types';

export function EventsStats(params = {}): TEventsStats {
  return {
    data: [
      [new Date().getTime(), [{count: 321}, {count: 79}]],
      [new Date().getTime(), [{count: 123}]],
    ],
    ...params,
  };
}

export function DetailedEvents(): Event[] {
  return [
    {
      eventID: '807f0de4d8c246098f21f8e0f1684f3d',
      packages: {},
      dist: null,
      tags: [
        {value: 'Chrome 59.0.3071', key: 'browser'},
        {value: 'Chrome', key: 'browser.name'},
        {value: 'error', key: 'level'},
        {value: 'javascript', key: 'logger'},
        {value: 'Mac OS X 10.12.5', key: 'os'},
        {value: 'Mac OS X', key: 'os.name'},
        {value: 'd5241c9d9d2bcda918c7af72f07cea1e39a096ac', key: 'release'},
        {
          value: 'app/components/assigneeSelector in assignedTo',
          key: 'transaction',
        },
        {
          value: 'http://localhost:8000/sentry/internal/issues/227/grouping/',
          key: 'url',
        },
        {value: 'id:1', key: 'user'},
      ],
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
      dateReceived: '2017-07-26T00:34:20Z',
      dateCreated: '2017-07-26T00:34:20Z',
      fingerprints: [
        '2c4887696f708c476a81ce4e834c4b02',
        'e05da55328a860b21f62e371f0a7507d',
      ],
      metadata: {
        type: 'TypeError',
        value: "Cannot read property 'assignedTo' of undefined",
      },
      groupID: '268',
      platform: 'javascript',
      errors: [],
      user: {ip_address: '127.0.0.1', email: 'billy@sentry.io', id: '1'},
      context: {'session:duration': 46363},
      entries: [],
      title: "TypeError: Cannot read property 'assignedTo' of undefined",
      message:
        "TypeError Cannot read property 'assignedTo' of undefined app/components/assigneeSelector in assignedTo",
      sdk: {
        version: '3.16.1',
        name: 'raven-js',
      },
      type: EventOrGroupType.ERROR,
      id: '904',
      size: 21896,
      crashFile: null,
      culprit: 'callback(app/utils/handleXhrErrorResponse)',
      location: './app/utils/handleXhrErrorResponse.tsx',
      occurrence: null,
      projectID: '1',
      resolvedWith: [],
    },
    {
      eventID: '807f0de4d8c246098f21f8e0f1684f3d',
      packages: {},
      dist: null,
      tags: [
        {value: 'Chrome 59.0.3071', key: 'browser'},
        {value: 'Chrome', key: 'browser.name'},
        {value: 'error', key: 'level'},
        {value: 'javascript', key: 'logger'},
        {value: 'Mac OS X 10.12.5', key: 'os'},
        {value: 'Mac OS X', key: 'os.name'},
        {value: 'd5241c9d9d2bcda918c7af72f07cea1e39a096ac', key: 'release'},
        {
          value: 'app/components/assigneeSelector in assignedTo',
          key: 'transaction',
        },
        {
          value: 'http://localhost:8000/sentry/internal/issues/227/grouping/',
          key: 'url',
        },
        {value: 'id:1', key: 'user'},
      ],
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
      dateReceived: '2017-07-26T00:34:20Z',
      dateCreated: '2017-07-26T00:34:20Z',
      fingerprints: [
        '2c4887696f708c476a81ce4e834c4b02',
        'e05da55328a860b21f62e371f0a7507d',
      ],
      metadata: {
        type: 'TypeError',
        value: "Cannot read property 'assignedTo' of undefined",
      },
      groupID: '268',
      platform: 'javascript',
      errors: [],
      user: {ip_address: '127.0.0.1', email: 'billy@sentry.io', id: '1'},
      context: {'session:duration': 46363},
      entries: [],
      title: "TypeError: Cannot read property 'assignedTo' of undefined",
      message:
        "TypeError Cannot read property 'assignedTo' of undefined app/components/assigneeSelector in assignedTo",
      sdk: {
        version: '3.16.1',
        name: 'raven-js',
      },
      type: EventOrGroupType.ERROR,
      id: '905',
      size: 21896,
      crashFile: null,
      culprit: 'callback(app/utils/handleXhrErrorResponse)',
      location: './app/utils/handleXhrErrorResponse.tsx',
      occurrence: null,
      projectID: '1',
      resolvedWith: [],
    },
  ];
}
