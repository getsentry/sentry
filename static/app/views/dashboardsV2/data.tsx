import {t} from 'sentry/locale';
import {uniqueId} from 'sentry/utils/guid';

import {DashboardDetails, DisplayType} from './types';

export const EMPTY_DASHBOARD: DashboardDetails = {
  id: '',
  dateCreated: '',
  createdBy: undefined,
  title: t('Untitled dashboard'),
  widgets: [],
};

export const DASHBOARDS_TEMPLATES: DashboardDetails[] = [
  {
    // This also exists in the backend at sentry/models/dashboard.py
    id: 'default-template',
    dateCreated: '',
    createdBy: undefined,
    title: t('Default'),
    widgets: [
      {
        title: t('Number of Errors'),
        displayType: DisplayType.BIG_NUMBER,
        interval: '5m',
        queries: [
          {
            name: '',
            conditions: '!event.type:transaction',
            fields: ['count()'],
            orderby: 'count()',
          },
        ],
        tempId: uniqueId(),
      },
      {
        title: t('Number of Issues'),
        displayType: DisplayType.BIG_NUMBER,
        interval: '5m',
        queries: [
          {
            name: '',
            conditions: '!event.type:transaction',
            fields: ['count_unique(issue)'],
            orderby: 'count_unique(issue)',
          },
        ],
        tempId: uniqueId(),
      },
      {
        title: t('Events'),
        displayType: DisplayType.LINE,
        interval: '5m',
        queries: [
          {
            name: t('Events'),
            conditions: '!event.type:transaction',
            fields: ['count()'],
            orderby: 'count()',
          },
        ],
        tempId: uniqueId(),
      },
      {
        title: t('Affected Users'),
        displayType: DisplayType.LINE,
        interval: '5m',
        queries: [
          {
            name: t('Known Users'),
            conditions: 'has:user.email !event.type:transaction',
            fields: ['count_unique(user)'],
            orderby: 'count_unique(user)',
          },
          {
            name: t('Anonymous Users'),
            conditions: '!has:user.email !event.type:transaction',
            fields: ['count_unique(user)'],
            orderby: 'count_unique(user)',
          },
        ],
        tempId: uniqueId(),
      },
      {
        title: t('Handled vs. Unhandled'),
        displayType: DisplayType.LINE,
        interval: '5m',
        queries: [
          {
            name: t('Handled'),
            conditions: 'error.handled:true',
            fields: ['count()'],
            orderby: 'count()',
          },
          {
            name: t('Unhandled'),
            conditions: 'error.handled:false',
            fields: ['count()'],
            orderby: 'count()',
          },
        ],
        tempId: uniqueId(),
      },
      {
        title: t('Errors by Country'),
        displayType: DisplayType.WORLD_MAP,
        interval: '5m',
        queries: [
          {
            name: t('Error counts'),
            conditions: '!event.type:transaction has:geo.country_code',
            fields: ['count()'],
            orderby: 'count()',
          },
        ],
        tempId: uniqueId(),
      },
      {
        title: t('Errors by Browser'),
        displayType: DisplayType.TABLE,
        interval: '5m',
        queries: [
          {
            name: '',
            conditions: '!event.type:transaction has:browser.name',
            fields: ['browser.name', 'count()'],
            orderby: '-count',
          },
        ],
        tempId: uniqueId(),
      },
    ],
  },
  {
    id: 'frontend-template',
    title: t('Frontend'),
    dateCreated: '',
    createdBy: undefined,
    widgets: [
      {
        title: t('Overall LCP'),
        displayType: DisplayType.BIG_NUMBER,
        interval: '5m',
        queries: [
          {
            name: '',
            conditions: 'event.type:transaction',
            fields: ['p75(measurements.lcp)'],
            orderby: 'measurements.lcp',
          },
        ],
        tempId: uniqueId(),
      },
      {
        title: t('Overall FCP'),
        displayType: DisplayType.BIG_NUMBER,
        interval: '5m',
        queries: [
          {
            name: '',
            conditions: 'event.type:transaction',
            fields: ['p75(measurements.fcp)'],
            orderby: 'measurements.fcp',
          },
        ],
        tempId: uniqueId(),
      },
      {
        title: t('Overall FID'),
        displayType: DisplayType.BIG_NUMBER,
        interval: '5m',
        queries: [
          {
            name: '',
            conditions: 'event.type:transaction',
            fields: ['p75(measurements.fid)'],
            orderby: 'measurements.fid',
          },
        ],
        tempId: uniqueId(),
      },
      {
        title: t('LCP over time'),
        displayType: DisplayType.LINE,
        interval: '5m',
        queries: [
          {
            name: t('LCP'),
            conditions: 'event.type:transaction',
            fields: ['p75(measurements.lcp)'],
            orderby: 'measurements.lcp',
          },
        ],
        tempId: uniqueId(),
      },
      {
        title: t('FCP over time'),
        displayType: DisplayType.LINE,
        interval: '5m',
        queries: [
          {
            name: t('FCP'),
            conditions: 'event.type:transaction',
            fields: ['p75(measurements.fcp)'],
            orderby: 'measurements.fcp',
          },
        ],
        tempId: uniqueId(),
      },
      {
        title: t('FID over time'),
        displayType: DisplayType.LINE,
        interval: '5m',
        queries: [
          {
            name: t('FID'),
            conditions: 'event.type:transaction',
            fields: ['p75(measurements.fid)'],
            orderby: 'measurements.fid',
          },
        ],
        tempId: uniqueId(),
      },
    ],
  },
  {
    id: 'backend-template',
    title: t('Backend'),
    dateCreated: '',
    createdBy: undefined,
    widgets: [
      {
        title: t('Overall Apdex'),
        displayType: DisplayType.BIG_NUMBER,
        interval: '5m',
        queries: [
          {
            name: '',
            conditions: 'event.type:transaction',
            fields: ['apdex()'],
            orderby: 'apdex',
          },
        ],
        tempId: uniqueId(),
      },
      {
        title: t('Failing Transactions'),
        displayType: DisplayType.BIG_NUMBER,
        interval: '5m',
        queries: [
          {
            name: '',
            conditions: 'event.type:transaction',
            fields: ['failure_count()'],
            orderby: 'failure_count',
          },
        ],
        tempId: uniqueId(),
      },
      {
        title: t('Overall Misery'),
        displayType: DisplayType.BIG_NUMBER,
        interval: '5m',
        queries: [
          {
            name: '',
            conditions: 'event.type:transaction',
            fields: ['user_misery()'],
            orderby: 'user_misery',
          },
        ],
        tempId: uniqueId(),
      },
      {
        title: t('Apdex over time'),
        displayType: DisplayType.LINE,
        interval: '5m',
        queries: [
          {
            name: t('Apdex'),
            conditions: 'event.type:transaction',
            fields: ['apdex()'],
            orderby: 'apdex',
          },
        ],
        tempId: uniqueId(),
      },
      {
        title: t('Failure Transactions over time'),
        displayType: DisplayType.LINE,
        interval: '5m',
        queries: [
          {
            name: t('Failing Transactions'),
            conditions: 'event.type:transaction',
            fields: ['failure_count()'],
            orderby: 'failure_count',
          },
        ],
        tempId: uniqueId(),
      },
      {
        title: t('Misery over time'),
        displayType: DisplayType.LINE,
        interval: '5m',
        queries: [
          {
            name: t('Miserable Users'),
            conditions: 'event.type:transaction',
            fields: ['user_misery()'],
            orderby: 'user_misery',
          },
        ],
        tempId: uniqueId(),
      },
    ],
  },
  {
    id: 'mobile-template',
    title: t('Mobile'),
    dateCreated: '',
    createdBy: undefined,
    widgets: [
      {
        title: t('Total Crashes'),
        displayType: DisplayType.BIG_NUMBER,
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['count()'],
            conditions: 'error.handled:false event.type:error',
            orderby: '',
          },
        ],
        tempId: uniqueId(),
      },
      {
        title: t('Unique Users Who Crashed'),
        displayType: DisplayType.BIG_NUMBER,
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['count_unique(user)'],
            conditions: 'error.handled:false event.type:error',
            orderby: '',
          },
        ],
        tempId: uniqueId(),
      },
      {
        title: t('Overall Number of Errors'),
        displayType: DisplayType.BIG_NUMBER,
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['count()'],
            conditions: 'event.type:error',
            orderby: '',
          },
        ],
        tempId: uniqueId(),
      },
      {
        title: t('Issues Causing Crashes'),
        displayType: DisplayType.TABLE,
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['issue', 'count()', 'count_unique(user)'],
            conditions: 'error.handled:false',
            orderby: '-count_unique_user',
          },
        ],
        tempId: uniqueId(),
      },
      {
        title: t('Crashes Over Time'),
        displayType: DisplayType.LINE,
        interval: '5m',
        queries: [
          {
            name: t('Crashes'),
            fields: ['count()', 'count_unique(user)'],
            conditions: 'error.handled:false',
            orderby: '',
          },
        ],
        tempId: uniqueId(),
      },
      {
        title: t('Crashes by OS'),
        displayType: DisplayType.TABLE,
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['os', 'count()'],
            conditions: 'has:os error.handled:false',
            orderby: '-count',
          },
        ],
        tempId: uniqueId(),
      },
      {
        title: t('Overall Warm Startup Time'),
        displayType: DisplayType.BIG_NUMBER,
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['p75(measurements.app_start_warm)'],
            conditions: 'has:measurements.app_start_warm',
            orderby: '',
          },
        ],
        tempId: uniqueId(),
      },
      {
        title: t('Overall Cold Startup Time'),
        displayType: DisplayType.BIG_NUMBER,
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['p75(measurements.app_start_cold)'],
            conditions: 'has:measurements.app_start_cold',
            orderby: '',
          },
        ],
        tempId: uniqueId(),
      },
      {
        title: t('Overall Throughput'),
        displayType: DisplayType.BIG_NUMBER,
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['epm()'],
            conditions: '',
            orderby: '',
          },
        ],
        tempId: uniqueId(),
      },
      {
        title: t('Warm Startup Times'),
        displayType: DisplayType.TABLE,
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['transaction', 'p75(measurements.app_start_warm)'],
            conditions: 'has:measurements.app_start_warm',
            orderby: '',
          },
        ],
        tempId: uniqueId(),
      },
      {
        title: t('Cold Startup Times'),
        displayType: DisplayType.TABLE,
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['transaction', 'p75(measurements.app_start_cold)'],
            conditions: 'has:measurements.app_start_cold',
            orderby: '',
          },
        ],
        tempId: uniqueId(),
      },
      {
        title: t('Throughput Over Time'),
        displayType: DisplayType.LINE,
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['epm()'],
            conditions: '',
            orderby: '',
          },
        ],
        tempId: uniqueId(),
      },
      {
        title: t('Frozen Frames Over Time'),
        displayType: DisplayType.BIG_NUMBER,
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['p75(measurements.frames_frozen_rate)'],
            conditions: '',
            orderby: '',
          },
        ],
        tempId: uniqueId(),
      },
      {
        title: t('Frozen Frames Rate'),
        displayType: DisplayType.TABLE,
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['transaction', 'p75(measurements.frames_frozen_rate)'],
            conditions: 'has:measurements.frames_frozen_rate',
            orderby: '-p75_measurements_frames_frozen_rate',
          },
        ],
        tempId: uniqueId(),
      },
    ],
  },
];

export const DISPLAY_TYPE_CHOICES = [
  {label: t('Area Chart'), value: 'area'},
  {label: t('Bar Chart'), value: 'bar'},
  {label: t('Line Chart'), value: 'line'},
  {label: t('Table'), value: 'table'},
  {label: t('World Map'), value: 'world_map'},
  {label: t('Big Number'), value: 'big_number'},
  {label: t('Top 5 Events'), value: 'top_n'},
];

export const INTERVAL_CHOICES = [
  {label: t('1 Minute'), value: '1m'},
  {label: t('5 Minutes'), value: '5m'},
  {label: t('15 Minutes'), value: '15m'},
  {label: t('30 Minutes'), value: '30m'},
  {label: t('1 Hour'), value: '1h'},
  {label: t('1 Day'), value: '1d'},
];

export const DEFAULT_STATS_PERIOD = '24h';
