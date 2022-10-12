const defaultRRWebEvents = [
  {
    type: 0,
    data: {},
    timestamp: 1663865919000,
    delay: -198487,
  },
  {
    type: 1,
    data: {},
    timestamp: 1663865920587,
    delay: -135199,
  },
  {
    type: 4,
    data: {
      href: 'http://localhost:3000/',
      width: 1536,
      height: 722,
    },
    timestamp: 1663865920587,
    delay: -135199,
  },
];

const defaultBreadcrumbs = [
  {
    timestamp: 1663865920.851,
    type: 'default',
    level: 'info',
    category: 'ui.focus',
  },
  {
    timestamp: 1663865922.024,
    type: 'default',
    level: 'info',
    category: 'ui.click',
    message:
      'input.form-control[type="text"][name="url"][title="Fully qualified URL prefixed with http or https"]',
    data: {
      nodeId: 37,
    },
  },
];

export function ReplayReaderParams({
  replayRecord = {},
  rrwebEvents = defaultRRWebEvents,
  breadcrumbs = defaultBreadcrumbs,
  spans = [],
  errors = [],
} = {}) {
  return {
    replayRecord: {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
      title: '',
      projectId: '6273278',
      platform: 'javascript',
      releases: ['1.0.0', '2.0.0'],
      dist: '',
      traceIds: [],
      errorIds: ['5c83aaccfffb4a708ae893bad9be3a1c'],
      startedAt: new Date('Sep 22, 2022 4:58:39 PM UTC'),
      finishedAt: new Date('Sep 22, 2022 5:00:03 PM UTC'),
      duration: 84,
      countSegments: 14,
      countErrors: 1,
      id: '761104e184c64d439ee1014b72b4d83b',
      longestTransaction: 0,
      environment: 'demo',
      tags: {},
      user: {
        id: '',
        name: '',
        email: '',
        ip_address: '127.0.0.1',
        displayName: '127.0.0.1',
      },
      sdk: {
        name: 'sentry.javascript.browser',
        version: '7.1.1',
      },
      os: {
        name: 'Other',
        version: '',
      },
      browser: {
        name: 'Other',
        version: '',
      },
      device: {
        name: '',
        brand: '',
        model: '',
        family: 'Other',
      },
      urls: ['http://localhost:3000/'],
      countUrls: 1,
      ...replayRecord,
    },
    rrwebEvents,
    breadcrumbs,
    spans,
    errors,
  };
}
