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
    timestamp: 1663865920851,
    type: 5,
    data: {
      payload: {
        timestamp: 1663865920.851,
        type: 'default',
        level: 'info',
        category: 'ui.focus',
      },
    },
  },
  {
    timestamp: 1663865922024,
    type: 5,
    data: {
      payload: {
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
    },
  },
];

export function ReplayReaderParams({
  attachments = [...defaultRRWebEvents, ...defaultBreadcrumbs],
  replayRecord = {},
  errors = [],
} = {}) {
  return {
    replayRecord: {
      activity: 0,
      browser: {
        name: 'Other',
        version: '',
      },
      count_errors: 1,
      count_segments: 14,
      count_urls: 1,
      device: {
        name: '',
        brand: '',
        model_id: '',
        family: 'Other',
      },
      dist: '',
      duration: 84,
      environment: 'demo',
      error_ids: ['5c83aaccfffb4a708ae893bad9be3a1c'],
      finished_at: new Date('Sep 22, 2022 5:00:03 PM UTC'),
      id: '761104e184c64d439ee1014b72b4d83b',
      longest_transaction: 0,
      os: {
        name: 'Other',
        version: '',
      },
      platform: 'javascript',
      project_id: '6273278',
      releases: ['1.0.0', '2.0.0'],
      sdk: {
        name: 'sentry.javascript.browser',
        version: '7.1.1',
      },
      started_at: new Date('Sep 22, 2022 4:58:39 PM UTC'),
      tags: {},
      trace_ids: [],
      urls: ['http://localhost:3000/'],
      user: {
        id: '',
        name: '',
        email: '',
        ip: '127.0.0.1',
        display_name: '127.0.0.1',
      },
      ...replayRecord,
    },
    attachments,
    errors,
  };
}
