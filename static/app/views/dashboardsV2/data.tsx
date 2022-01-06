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
        title: 'Number of Errors',
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
        title: 'Number of Issues',
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
        title: 'Events',
        displayType: DisplayType.LINE,
        interval: '5m',
        queries: [
          {
            name: 'Events',
            conditions: '!event.type:transaction',
            fields: ['count()'],
            orderby: 'count()',
          },
        ],
        tempId: uniqueId(),
      },
      {
        title: 'Affected Users',
        displayType: DisplayType.LINE,
        interval: '5m',
        queries: [
          {
            name: 'Known Users',
            conditions: 'has:user.email !event.type:transaction',
            fields: ['count_unique(user)'],
            orderby: 'count_unique(user)',
          },
          {
            name: 'Anonymous Users',
            conditions: '!has:user.email !event.type:transaction',
            fields: ['count_unique(user)'],
            orderby: 'count_unique(user)',
          },
        ],
        tempId: uniqueId(),
      },
      {
        title: 'Handled vs. Unhandled',
        displayType: DisplayType.LINE,
        interval: '5m',
        queries: [
          {
            name: 'Handled',
            conditions: 'error.handled:true',
            fields: ['count()'],
            orderby: 'count()',
          },
          {
            name: 'Unhandled',
            conditions: 'error.handled:false',
            fields: ['count()'],
            orderby: 'count()',
          },
        ],
        tempId: uniqueId(),
      },
      {
        title: 'Errors by Country',
        displayType: DisplayType.WORLD_MAP,
        interval: '5m',
        queries: [
          {
            name: 'Error counts',
            conditions: '!event.type:transaction has:geo.country_code',
            fields: ['count()'],
            orderby: 'count()',
          },
        ],
        tempId: uniqueId(),
      },
      {
        title: 'Errors by Browser',
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
    title: 'Frontend',
    dateCreated: '',
    createdBy: undefined,
    widgets: [
      {
        title: 'Overall LCP',
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
        title: 'Overall FCP',
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
        title: 'Overall FID',
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
        title: 'LCP over time',
        displayType: DisplayType.LINE,
        interval: '5m',
        queries: [
          {
            name: 'LCP',
            conditions: 'event.type:transaction',
            fields: ['p75(measurements.lcp)'],
            orderby: 'measurements.lcp',
          },
        ],
        tempId: uniqueId(),
      },
      {
        title: 'FCP over time',
        displayType: DisplayType.LINE,
        interval: '5m',
        queries: [
          {
            name: 'FCP',
            conditions: 'event.type:transaction',
            fields: ['p75(measurements.fcp)'],
            orderby: 'measurements.fcp',
          },
        ],
        tempId: uniqueId(),
      },
      {
        title: 'FID over time',
        displayType: DisplayType.LINE,
        interval: '5m',
        queries: [
          {
            name: 'FID',
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
    title: 'Backend',
    dateCreated: '',
    createdBy: undefined,
    widgets: [
      {
        title: 'Overall Apdex',
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
        title: 'Failing Transactions',
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
        title: 'Overall Misery',
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
        title: 'Apdex over time',
        displayType: DisplayType.LINE,
        interval: '5m',
        queries: [
          {
            name: 'Apdex',
            conditions: 'event.type:transaction',
            fields: ['apdex()'],
            orderby: 'apdex',
          },
        ],
        tempId: uniqueId(),
      },
      {
        title: 'Failure Transactions over time',
        displayType: DisplayType.LINE,
        interval: '5m',
        queries: [
          {
            name: 'Failing Transactions',
            conditions: 'event.type:transaction',
            fields: ['failure_count()'],
            orderby: 'failure_count',
          },
        ],
        tempId: uniqueId(),
      },
      {
        title: 'Misery over time',
        displayType: DisplayType.LINE,
        interval: '5m',
        queries: [
          {
            name: 'Miserable Users',
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
    title: 'Mobile',
    dateCreated: '',
    createdBy: undefined,
    widgets: [
      {
        title: 'Overall Cold Start',
        displayType: DisplayType.BIG_NUMBER,
        interval: '5m',
        queries: [
          {
            name: '',
            conditions: 'event.type:transaction',
            fields: ['p75(measurements.app_start_cold)'],
            orderby: 'p75(measurements.app_start_cold)',
          },
        ],
        tempId: uniqueId(),
      },
      {
        title: 'Overall Warm Start',
        displayType: DisplayType.BIG_NUMBER,
        interval: '5m',
        queries: [
          {
            name: '',
            conditions: 'event.type:transaction',
            fields: ['p75(measurements.app_start_warm)'],
            orderby: 'p75(measurements.app_start_warm)',
          },
        ],
        tempId: uniqueId(),
      },
      {
        title: 'Transactions Per Minute',
        displayType: DisplayType.BIG_NUMBER,
        interval: '5m',
        queries: [
          {
            name: '',
            conditions: 'event.type:transaction',
            fields: ['tpm()'],
            orderby: 'tpm',
          },
        ],
        tempId: uniqueId(),
      },
      {
        title: 'Cold Start over time',
        displayType: DisplayType.LINE,
        interval: '5m',
        queries: [
          {
            name: 'Cold Start',
            conditions: 'event.type:transaction',
            fields: ['p75(measurements.app_start_cold)'],
            orderby: 'p75(measurements.app_start_cold)',
          },
        ],
        tempId: uniqueId(),
      },
      {
        title: 'Warm Start over time',
        displayType: DisplayType.LINE,
        interval: '5m',
        queries: [
          {
            name: 'Warm Start',
            conditions: 'event.type:transaction',
            fields: ['p75(measurements.app_start_warm)'],
            orderby: 'p75(measurements.app_start_warm)',
          },
        ],
        tempId: uniqueId(),
      },
      {
        title: 'TPM over time',
        displayType: DisplayType.LINE,
        interval: '5m',
        queries: [
          {
            name: 'TPM',
            conditions: 'event.type:transaction',
            fields: ['tpm()'],
            orderby: 'tpm',
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
