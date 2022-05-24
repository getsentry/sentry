import {eventWithTime} from 'rrweb/typings/types';

import {EntryType, EventOrGroupType, EventTransaction} from 'sentry/types';
import {BreadcrumbLevelType, BreadcrumbType} from 'sentry/types/breadcrumbs';
import type {Entry, Event} from 'sentry/types/event';

export function createEventTransaction(): EventTransaction {
  return {
    id: '364855ec0c304d14be9980f0001a08b9',
    eventID: '364855ec0c304d14be9980f0001a08b9',
    projectID: '6301687',
    size: 2272,
    entries: [
      {data: [], type: EntryType.SPANS},
      {
        data: {
          method: '',
          url: 'https://sourcemaps.io/',
          query: [],
          headers: [
            ['Referer', 'https://www.google.com/'],
            [
              'User-Agent',
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:100.0) Gecko/20100101 Firefox/100.0',
            ],
          ],
          cookies: [],
          inferredContentType: null,
        },
        type: EntryType.REQUEST,
      },
    ],
    dist: null,
    message: '',
    title: 'sentry-replay',
    location: 'sentry-replay',
    user: {
      username: null,
      ip_address: '',
      name: null,
      data: null,
    },
    contexts: {
      os: {name: 'Windows', version: '10', type: 'os', build: '', kernel_version: ''},
    },
    type: EventOrGroupType.TRANSACTION,
    metadata: {title: 'sentry-replay'},
    tags: [
      {key: 'browser', value: 'Firefox 100.0'},
      {key: 'browser.name', value: 'Firefox'},
      {key: 'environment', value: 'production'},
      {key: 'isReplayRoot', value: 'yes'},
      {key: 'level', value: BreadcrumbLevelType.INFO},
      {key: 'os', value: 'Windows 10'},
      {key: 'os.name', value: 'Windows'},
      {key: 'release', value: '90df8bed9f9d4dd20de622c9e7eace4ec578ff1a'},
      {key: 'transaction', value: 'sentry-replay'},
      {key: 'url', value: 'https://sourcemaps.io/'},
      {key: 'user', value: ''},
    ],
    dateReceived: '2022-05-25T11:51:53.892536Z',
    errors: [],
    startTimestamp: 1653479512.993,
    endTimestamp: 1653479512.993,
    projectSlug: 'sourcemapsio-replays',
    crashFile: null,
    culprit: '',
    fingerprints: [],
    groupingConfig: {enhancements: '', id: ''},
  };
}

export function createRrWebEvents(): eventWithTime[] {
  return [
    {
      data: {
        height: 1019,
        href: 'https://sourcemaps.io/',
        width: 1920,
      },
      timestamp: 1653479511719,
      type: 4,
    },
  ];
}

function createEntries(): Entry[] {
  return [
    {
      data: {
        values: [
          {
            category: 'sentry.transaction',
            type: BreadcrumbType.DEFAULT,
            timestamp: '2022-05-25T11:51:52.995000Z',
            level: BreadcrumbLevelType.INFO,
          },
          {
            category: 'sentry.transaction',
            type: BreadcrumbType.DEFAULT,
            timestamp: '2022-05-25T11:51:53.010000Z',
            level: BreadcrumbLevelType.INFO,
          },
          {
            type: BreadcrumbType.DEFAULT,
            timestamp: '2022-05-25T11:52:17.799000Z',
            level: BreadcrumbLevelType.INFO,
            category: 'navigation',
            data: {
              from: '/',
              to: '/report/newUrl',
            },
            event_id: null,
          },
          {
            type: BreadcrumbType.HTTP,
            timestamp: '2022-05-25T11:52:18.227000Z',
            level: BreadcrumbLevelType.INFO,
            category: 'fetch',
            data: {
              method: 'GET',
              status_code: 200,
              url: '',
            },
            event_id: null,
          },
          {
            type: BreadcrumbType.DEFAULT,
            timestamp: '2022-05-25T11:53:17.799000Z',
            level: BreadcrumbLevelType.INFO,
            category: 'navigation',
            data: {
              from: '/',
              to: '/report/newUrl/2',
            },
            event_id: null,
          },
          {
            type: BreadcrumbType.HTTP,
            timestamp: '2022-05-25T11:52:18.227000Z',
            level: BreadcrumbLevelType.INFO,
            category: 'fetch',
            data: {
              method: 'GET',
              status_code: 200,
              url: '',
            },
            event_id: null,
          },
          {
            type: BreadcrumbType.DEFAULT,
            timestamp: '2022-05-25T11:54:17.799000Z',
            level: BreadcrumbLevelType.INFO,
            category: 'navigation',
            data: {
              from: '/',
              to: '/report/newUrl/3',
            },
            event_id: null,
          },
          {
            type: BreadcrumbType.DEFAULT,
            timestamp: '2022-05-25T11:54:17.799000Z',
            level: BreadcrumbLevelType.INFO,
            category: 'navigation',
            data: {
              from: '/',
              to: '/report/newUrl/4',
            },
            event_id: null,
          },
        ],
      },
      type: EntryType.BREADCRUMBS,
    },
    {
      data: {
        method: 'GET',
        url: 'https://sourcemaps.io/report/newUrl',
        query: [],
        headers: [
          ['Referer', 'https://www.google.com/'],
          [
            'User-Agent',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:100.0) Gecko/20100101 Firefox/100.0',
          ],
        ],
        inferredContentType: null,
      },
      type: EntryType.REQUEST,
    },
  ];
}

export function createReplayEvents(): Event[] {
  return [
    {
      id: 'ebfd6fae44544e5eb2e26f06bd573423',
      eventID: 'ebfd6fae44544e5eb2e26f06bd573423',
      projectID: '6301687',
      size: 2610,
      entries: [
        {data: [], type: EntryType.SPANS},
        {
          data: {
            method: 'GET',
            url: 'https://sourcemaps.io/',
            query: [],
            headers: [
              ['Referer', 'https://www.google.com/'],
              [
                'User-Agent',
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:100.0) Gecko/20100101 Firefox/100.0',
              ],
            ],
            cookies: [],
            inferredContentType: null,
          },
          type: EntryType.REQUEST,
        },
      ],
      dist: null,
      message: '',
      title: 'sentry-replay-event',
      location: 'sentry-replay-event',
      user: {
        username: null,
        ip_address: '',
        name: null,
        data: null,
      },
      contexts: {
        os: {name: 'Windows', version: '10', type: 'os', build: '', kernel_version: ''},
        trace: {
          trace_id: 'afa8cf0b16df4cdcba7267894712b0eb',
          span_id: 'a0e466b9236563bb',
          parent_span_id: '9727713e4d49a556',
          op: BreadcrumbType.DEFAULT,
          status: 'ok',
          exclusive_time: 13.999939,
          hash: '5c9a2f7e440bc691',
        },
      },
      sdk: {name: 'sentry.javascript.react', version: '6.19.3'},
      context: {},
      packages: {},
      type: EventOrGroupType.TRANSACTION,
      metadata: {title: 'sentry-replay-event'},
      tags: [
        {key: 'browser', value: 'Firefox 100.0'},
        {key: 'browser.name', value: 'Firefox'},
        {key: 'environment', value: 'production'},
        {key: 'level', value: BreadcrumbLevelType.INFO},
        {key: 'os', value: 'Windows 10'},
        {key: 'os.name', value: 'Windows'},
        {key: 'release', value: '90df8bed9f9d4dd20de622c9e7eace4ec578ff1a'},
        {key: 'replayId', value: '364855ec0c304d14be9980f0001a08b9'},
        {key: 'transaction', value: 'sentry-replay-event'},
        {key: 'url', value: 'https://sourcemaps.io/'},
        {key: 'user', value: ''},
      ],
      dateReceived: '2022-05-25T11:51:53.525330Z',
      errors: [],
      startTimestamp: 1653479512.994,
      endTimestamp: 1653479513.008,
      projectSlug: 'sourcemapsio-replays',
      crashFile: null,
      culprit: '',
      fingerprints: [],
      groupingConfig: {enhancements: '', id: ''},
    },
    {
      id: '0d8065d643e34082a2f147122df3afd8',
      eventID: '0d8065d643e34082a2f147122df3afd8',
      projectID: '6301687',
      size: 6827,
      entries: createEntries(),
      dist: null,
      message: '',
      title: 'sentry-replay-event',
      location: 'sentry-replay-event',
      user: {
        username: null,
        ip_address: '',
        name: null,
        data: null,
      },
      contexts: {
        os: {name: 'Windows', version: '10', type: 'os', build: '', kernel_version: ''},
        trace: {
          trace_id: 'afa8cf0b16df4cdcba7267894712b0eb',
          span_id: '909c5ecfdd819ece',
          parent_span_id: '9727713e4d49a556',
          op: BreadcrumbType.DEFAULT,
          status: 'ok',
          exclusive_time: 8081.000089,
          hash: '5c9a2f7e440bc691',
        },
      },
      type: EventOrGroupType.TRANSACTION,
      metadata: {title: 'sentry-replay-event'},
      tags: [
        {key: 'browser', value: 'Firefox 100.0'},
        {key: 'browser.name', value: 'Firefox'},
        {key: 'environment', value: 'production'},
        {key: 'level', value: BreadcrumbLevelType.INFO},
        {key: 'os', value: 'Windows 10'},
        {key: 'os.name', value: 'Windows'},
        {key: 'release', value: '90df8bed9f9d4dd20de622c9e7eace4ec578ff1a'},
        {key: 'replayId', value: '364855ec0c304d14be9980f0001a08b9'},
        {key: 'transaction', value: 'sentry-replay-event'},
        {
          key: 'url',
          value: 'https://sourcemaps.io/report/newUrl',
        },
        {key: 'user', value: 'ip'},
      ],
      dateReceived: '2022-05-25T11:53:00.950478Z',
      errors: [],
      startTimestamp: 1653479572.786,
      endTimestamp: 1653479580.895,
      projectSlug: 'sourcemapsio-replays',
      crashFile: null,
      culprit: '',
      fingerprints: [],
      groupingConfig: {enhancements: '', id: ''},
    } as Event,
  ];
}
