import {t} from 'sentry/locale';
import {uniqueId} from 'sentry/utils/guid';

import {DashboardDetails, DisplayType, WidgetType} from './types';

type DashboardTemplate = DashboardDetails & {
  description: string;
};

export const EMPTY_DASHBOARD: DashboardDetails = {
  id: '',
  dateCreated: '',
  createdBy: undefined,
  title: t('Untitled dashboard'),
  widgets: [],
};

export const DASHBOARDS_TEMPLATES: DashboardTemplate[] = [
  {
    id: 'default-template',
    dateCreated: '',
    createdBy: undefined,
    title: t('General'),
    description: t('Various Frontend & Backend Widgets'),
    widgets: [
      {
        title: t('Number of Errors'),
        displayType: DisplayType.BIG_NUMBER,
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['count()'],
            conditions: '!event.type:transaction',
            orderby: 'count()',
          },
        ],
        widgetType: WidgetType.DISCOVER,
        tempId: uniqueId(),
      },
      {
        title: t('Number of Issues'),
        displayType: DisplayType.BIG_NUMBER,
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['count_unique(issue)'],
            conditions: '!event.type:transaction',
            orderby: 'count_unique(issue)',
          },
        ],
        widgetType: WidgetType.DISCOVER,
        tempId: uniqueId(),
      },
      {
        title: t('Events'),
        displayType: DisplayType.LINE,
        interval: '5m',
        queries: [
          {
            name: t('Events'),
            fields: ['count()'],
            conditions: '!event.type:transaction',
            orderby: 'count()',
          },
        ],
        widgetType: WidgetType.DISCOVER,
        tempId: uniqueId(),
      },
      {
        title: t('Affected Users'),
        displayType: DisplayType.LINE,
        interval: '5m',
        queries: [
          {
            name: t('Known Users'),
            fields: ['count_unique(user)'],
            conditions: 'has:user.email !event.type:transaction',
            orderby: 'count_unique(user)',
          },
          {
            name: t('Anonymous Users'),
            fields: ['count_unique(user)'],
            conditions: '!has:user.email !event.type:transaction',
            orderby: 'count_unique(user)',
          },
        ],
        widgetType: WidgetType.DISCOVER,
        tempId: uniqueId(),
      },
      {
        title: t('Handled vs. Unhandled'),
        displayType: DisplayType.LINE,
        interval: '5m',
        queries: [
          {
            name: t('Handled'),
            fields: ['count()'],
            conditions: 'error.handled:true',
            orderby: 'count()',
          },
          {
            name: t('Unhandled'),
            fields: ['count()'],
            conditions: 'error.handled:false',
            orderby: 'count()',
          },
        ],
        widgetType: WidgetType.DISCOVER,
        tempId: uniqueId(),
      },
      {
        title: t('Errors by Country'),
        displayType: DisplayType.WORLD_MAP,
        interval: '5m',
        queries: [
          {
            name: t('Error counts'),
            fields: ['count()'],
            conditions: '!event.type:transaction has:geo.country_code',
            orderby: 'count()',
          },
        ],
        widgetType: WidgetType.DISCOVER,
        tempId: uniqueId(),
      },
      {
        title: t('High Throughput Transactions'),
        displayType: DisplayType.TABLE,
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['count()', 'transaction'],
            conditions: '!event.type:error',
            orderby: '-count',
          },
        ],
        widgetType: WidgetType.DISCOVER,
        tempId: uniqueId(),
      },
      {
        title: t('Errors by Browser'),
        displayType: DisplayType.TABLE,
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['browser.name', 'count()'],
            conditions: '!event.type:transaction has:browser.name',
            orderby: '-count',
          },
        ],
        widgetType: WidgetType.DISCOVER,
        tempId: uniqueId(),
      },
      {
        title: t('Overall User Misery'),
        displayType: DisplayType.BIG_NUMBER,
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['user_misery(300)'],
            conditions: '',
            orderby: '',
          },
        ],
        widgetType: WidgetType.DISCOVER,
        tempId: uniqueId(),
      },
      {
        title: t('High Throughput Transactions'),
        displayType: DisplayType.TOP_N,
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['transaction', 'count()'],
            conditions: '!event.type:error',
            orderby: '-count',
          },
        ],
        widgetType: WidgetType.DISCOVER,
        tempId: uniqueId(),
      },
      {
        title: t('Issues Assigned to Me or My Teams'),
        displayType: DisplayType.TABLE,
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['assignee', 'issue', 'title'],
            conditions: 'assigned_or_suggested:me is:unresolved',
            orderby: 'priority',
          },
        ],
        widgetType: WidgetType.ISSUE,
        tempId: uniqueId(),
      },
      {
        title: t('Transactions Ordered by Misery'),
        displayType: DisplayType.TABLE,
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['transaction', 'user_misery(300)'],
            conditions: '',
            orderby: '-user_misery_300',
          },
        ],
        widgetType: WidgetType.DISCOVER,
        tempId: uniqueId(),
      },
    ],
  },
  {
    id: 'frontend-template',
    title: t('Frontend KPIs'),
    dateCreated: '',
    createdBy: undefined,
    description: t('Erroring URLs and Web Vitals'),
    widgets: [
      {
        title: t('Top 5 Issues by Unique Users over Time'),
        displayType: DisplayType.TOP_N,
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['issue', 'count_unique(user)'],
            conditions: '',
            orderby: '-count_unique_user',
          },
        ],
        widgetType: WidgetType.DISCOVER,
        tempId: uniqueId(),
      },
      {
        title: t('Errors by Browser as Percentage'),
        displayType: DisplayType.AREA,
        interval: '5m',
        queries: [
          {
            name: '',
            fields: [
              'equation|count_if(browser.name,equals,Chrome)/count() * 100',
              'equation|count_if(browser.name,equals,Firefox)/count() * 100',
              'equation|count_if(browser.name,equals,Safari)/count() * 100',
            ],
            conditions: 'has:browser.name',
            orderby: '',
          },
        ],
        widgetType: WidgetType.DISCOVER,
        tempId: uniqueId(),
      },
      {
        title: t('Issues Assigned to Me or My Teams'),
        displayType: DisplayType.TABLE,
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['assignee', 'issue', 'title'],
            conditions: 'assigned_or_suggested:me is:unresolved',
            orderby: 'priority',
          },
        ],
        widgetType: WidgetType.ISSUE,
        tempId: uniqueId(),
      },
      {
        title: t('Top 5 Issues by Unique Users'),
        displayType: DisplayType.TABLE,
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['issue', 'count_unique(user)', 'title'],
            conditions: '',
            orderby: '-count_unique_user',
          },
        ],
        widgetType: WidgetType.DISCOVER,
        tempId: uniqueId(),
      },
      {
        title: t('Urls grouped by Issue'),
        displayType: DisplayType.TABLE,
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['http.url', 'issue', 'count_unique(user)'],
            conditions: 'event.type:error',
            orderby: '-count_unique_user',
          },
        ],
        widgetType: WidgetType.DISCOVER,
        tempId: uniqueId(),
      },
      {
        title: t('Transactions 404ing'),
        displayType: DisplayType.TABLE,
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['transaction', 'count()'],
            conditions: 'transaction.status:not_found',
            orderby: '-count',
          },
        ],
        widgetType: WidgetType.DISCOVER,
        tempId: uniqueId(),
      },
      {
        title: t('Layout Shift over Time'),
        displayType: DisplayType.LINE,
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['p75(measurements.cls)'],
            conditions: '',
            orderby: '',
          },
        ],
        widgetType: WidgetType.DISCOVER,
        tempId: uniqueId(),
      },
      {
        title: t('LCP by Country'),
        displayType: DisplayType.WORLD_MAP,
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['p75(measurements.lcp)'],
            conditions: 'has:geo.country_code',
            orderby: '',
          },
        ],
        widgetType: WidgetType.DISCOVER,
        tempId: uniqueId(),
      },
      {
        title: t('Page Load over Time'),
        displayType: DisplayType.LINE,
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['p75(measurements.lcp)', 'p75(measurements.fcp)'],
            conditions: 'transaction.op:pageload',
            orderby: '',
          },
        ],
        widgetType: WidgetType.DISCOVER,
        tempId: uniqueId(),
      },
      {
        title: t('Slowest Pageloads'),
        displayType: DisplayType.TABLE,
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['transaction', 'count()'],
            conditions: 'transaction.op:pageload p75(measurements.lcp):>4s',
            orderby: '-count',
          },
        ],
        widgetType: WidgetType.DISCOVER,
        tempId: uniqueId(),
      },
      {
        title: t('Overall LCP'),
        displayType: DisplayType.BIG_NUMBER,
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['p75(measurements.lcp)'],
            conditions: '',
            orderby: '',
          },
        ],
        widgetType: WidgetType.DISCOVER,
        tempId: uniqueId(),
      },
      {
        title: t('Slow Page Navigations'),
        displayType: DisplayType.TABLE,
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['transaction', 'count()'],
            conditions: 'transaction.duration:>2s',
            orderby: '-count',
          },
        ],
        widgetType: WidgetType.DISCOVER,
        tempId: uniqueId(),
      },
      {
        title: t('Overall FCP'),
        displayType: DisplayType.BIG_NUMBER,
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['p75(measurements.fcp)'],
            conditions: '',
            orderby: '',
          },
        ],
        widgetType: WidgetType.DISCOVER,
        tempId: uniqueId(),
      },
    ],
  },
  {
    id: 'backend-template',
    title: t('Backend KPIs'),
    dateCreated: '',
    createdBy: undefined,
    description: t('Issues and Performance'),
    widgets: [
      {
        title: t('Top 5 Issues by Unique Users over Time'),
        displayType: DisplayType.TOP_N,
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['issue', 'count_unique(user)'],
            conditions: '',
            orderby: '-count_unique_user',
          },
        ],
        widgetType: WidgetType.DISCOVER,
        tempId: uniqueId(),
      },
      {
        title: t('Transactions Erroring Over Time'),
        displayType: DisplayType.TOP_N,
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['transaction', 'count()'],
            conditions: 'transaction.status:internal_error',
            orderby: '-count',
          },
        ],
        widgetType: WidgetType.DISCOVER,
        tempId: uniqueId(),
      },
      {
        title: t('Erroring Transactions by Percentage'),
        displayType: DisplayType.TABLE,
        interval: '5m',
        queries: [
          {
            name: '',
            fields: [
              'equation|count_if(transaction.status,equals,internal_error) / count() * 100',
              'transaction',
              'count_if(transaction.status,equals,internal_error)',
              'count()',
            ],
            conditions: 'count():>100',
            orderby: '-equation[0]',
          },
        ],
        widgetType: WidgetType.DISCOVER,
        tempId: uniqueId(),
      },
      {
        title: t('Top 5 Issues by Unique Users'),
        displayType: DisplayType.TABLE,
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['issue', 'count_unique(user)', 'title'],
            conditions: '',
            orderby: '-count_unique_user',
          },
        ],
        widgetType: WidgetType.DISCOVER,
        tempId: uniqueId(),
      },
      {
        title: t('Transactions Erroring'),
        displayType: DisplayType.TABLE,
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['count()', 'transaction'],
            conditions: 'transaction.status:internal_error',
            orderby: '-count',
          },
        ],
        widgetType: WidgetType.DISCOVER,
        tempId: uniqueId(),
      },
      {
        title: t('Issues Assigned to Me or My Teams'),
        displayType: DisplayType.TABLE,
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['assignee', 'issue', 'title'],
            conditions: 'assigned_or_suggested:me is:unresolved',
            orderby: 'priority',
          },
        ],
        widgetType: WidgetType.ISSUE,
        tempId: uniqueId(),
      },
      {
        title: t('p75(duration)'),
        displayType: DisplayType.WORLD_MAP,
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['p75(transaction.duration)'],
            conditions: '',
            orderby: '',
          },
        ],
        widgetType: WidgetType.DISCOVER,
        tempId: uniqueId(),
      },
      {
        title: t('p75 Over Time'),
        displayType: DisplayType.LINE,
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['p75(transaction.duration)'],
            conditions: '',
            orderby: '',
          },
        ],
        widgetType: WidgetType.DISCOVER,
        tempId: uniqueId(),
      },
      {
        title: t('Throughput (Events Per Minute)'),
        displayType: DisplayType.LINE,
        interval: '5m',
        queries: [
          {
            name: 'Transactions',
            fields: ['epm()'],
            conditions: 'event.type:transaction',
            orderby: '',
          },
          {
            name: 'Errors',
            fields: ['epm()'],
            conditions: 'event.type:error',
            orderby: '',
          },
        ],
        widgetType: WidgetType.DISCOVER,
        tempId: uniqueId(),
      },
      {
        title: t('Tasks Transactions with poor Apdex'),
        displayType: DisplayType.TABLE,
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['count()', 'transaction'],
            conditions: 'apdex():<0.5 transaction.op:*task*',
            orderby: '-count',
          },
        ],
        widgetType: WidgetType.DISCOVER,
        tempId: uniqueId(),
      },
      {
        title: t('HTTP Transactions with poor Apdex'),
        displayType: DisplayType.TABLE,
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['epm()', 'http.method', 'http.status_code', 'transaction'],
            conditions:
              'apdex():<0.5 transaction.op:*http* has:http.method has:http.status_code',
            orderby: '-epm',
          },
        ],
        widgetType: WidgetType.DISCOVER,
        tempId: uniqueId(),
      },
      {
        title: t('Overall Apdex'),
        displayType: DisplayType.BIG_NUMBER,
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['apdex(300)'],
            conditions: '',
            orderby: '',
          },
        ],
        widgetType: WidgetType.DISCOVER,
        tempId: uniqueId(),
      },
      {
        title: t('Overal P75'),
        displayType: DisplayType.BIG_NUMBER,
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['p75(transaction.duration)'],
            conditions: '',
            orderby: '',
          },
        ],
        widgetType: WidgetType.DISCOVER,
        tempId: uniqueId(),
      },
    ],
  },
  {
    id: 'mobile-template',
    title: t('Mobile KPIs'),
    dateCreated: '',
    createdBy: undefined,
    description: t('Crash Details and Performance Vitals'),
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
        widgetType: WidgetType.DISCOVER,
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
        widgetType: WidgetType.DISCOVER,
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
        widgetType: WidgetType.DISCOVER,
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
        widgetType: WidgetType.DISCOVER,
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
        widgetType: WidgetType.DISCOVER,
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
        widgetType: WidgetType.DISCOVER,
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
        widgetType: WidgetType.DISCOVER,
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
        widgetType: WidgetType.DISCOVER,
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
        widgetType: WidgetType.DISCOVER,
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
        widgetType: WidgetType.DISCOVER,
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
        widgetType: WidgetType.DISCOVER,
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
        widgetType: WidgetType.DISCOVER,
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
        widgetType: WidgetType.DISCOVER,
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
        widgetType: WidgetType.DISCOVER,
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
