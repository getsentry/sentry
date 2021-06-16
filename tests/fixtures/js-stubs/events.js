import {Event} from './event';

export function Events(params = []) {
  return [
    Event({eventID: '12345', id: '1', message: 'ApiException', groupID: '1'}),
    Event({
      eventID: '12346',
      id: '2',
      message: 'TestException',
      groupID: '1',
    }),
    ...params,
  ];
}

export function EventsStats(_query = {}, params) {
  return {
    data: [
      [new Date(), [{count: 321}, {count: 79}]],
      [new Date(), [{count: 123}]],
    ],
    ...params,
  };
}

export function DetailedEvents() {
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
        os: {version: '10.12.5', type: 'os', name: 'Mac OS X'},
        browser: {version: '59.0.3071', type: 'browser', name: 'Chrome'},
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
        clientIP: '127.0.0.1',
        version: '3.16.1',
        name: 'raven-js',
        upstream: {
          url: 'https://docs.sentry.io/clients/javascript/',
          isNewer: false,
          name: 'raven-js',
        },
      },
      type: 'error',
      id: '904',
      size: 21896,
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
        os: {version: '10.12.5', type: 'os', name: 'Mac OS X'},
        browser: {version: '59.0.3071', type: 'browser', name: 'Chrome'},
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
        clientIP: '127.0.0.1',
        version: '3.16.1',
        name: 'raven-js',
        upstream: {
          url: 'https://docs.sentry.io/clients/javascript/',
          isNewer: false,
          name: 'raven-js',
        },
      },
      type: 'error',
      id: '905',
      size: 21896,
    },
  ];
}
