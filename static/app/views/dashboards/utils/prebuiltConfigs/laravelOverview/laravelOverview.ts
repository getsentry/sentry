import {t} from 'sentry/locale';
import {FieldKind} from 'sentry/utils/fields';
import {DisplayType, WidgetType, type Widget} from 'sentry/views/dashboards/types';
import type {PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {
  BACKEND_OVERVIEW_FIRST_ROW_WIDGETS,
  BACKEND_OVERVIEW_SECOND_ROW_WIDGETS,
} from 'sentry/views/dashboards/utils/prebuiltConfigs/backendOverview/backendOverview';
import {DASHBOARD_TITLE} from 'sentry/views/dashboards/utils/prebuiltConfigs/laravelOverview/settings';
import {SpanFields} from 'sentry/views/insights/types';

const PATHS_TABLE: Widget = {
  id: 'paths-table',
  title: t('Paths'),
  displayType: DisplayType.TABLE,
  widgetType: WidgetType.SPANS,
  interval: '5m',
  queries: [
    {
      name: '',
      conditions: `${SpanFields.TRANSACTION_OP}:http.server ${SpanFields.IS_TRANSACTION}:true`,
      fields: [
        SpanFields.HTTP_REQUEST_METHOD,
        SpanFields.TRANSACTION,
        'count()',
        'failure_rate()',
        `avg(${SpanFields.SPAN_DURATION})`,
        `p95(${SpanFields.SPAN_DURATION})`,
        `sum(${SpanFields.SPAN_DURATION})`,
        `count_unique(${SpanFields.USER})`,
      ],
      columns: [SpanFields.HTTP_REQUEST_METHOD, SpanFields.TRANSACTION],
      aggregates: [
        'count()',
        'failure_rate()',
        `avg(${SpanFields.SPAN_DURATION})`,
        `p95(${SpanFields.SPAN_DURATION})`,
        `sum(${SpanFields.SPAN_DURATION})`,
        `count_unique(${SpanFields.USER})`,
      ],
      fieldAliases: [
        t('Method'),
        t('Path'),
        t('Requests'),
        t('Error Rate'),
        t('Avg'),
        t('P95'),
        t('Time Spent'),
        t('Users'),
      ],
      orderby: '-count()',
    },
  ],
  layout: {
    x: 0,
    y: 7,
    w: 6,
    h: 2,
    minH: 2,
  },
};

const COMMANDS_TABLE: Widget = {
  id: 'commands-table',
  title: t('Commands'),
  displayType: DisplayType.TABLE,
  widgetType: WidgetType.SPANS,
  interval: '5m',
  queries: [
    {
      name: '',
      conditions: `${SpanFields.SPAN_OP}:console.command*`,
      fields: [
        SpanFields.COMMAND,
        'count()',
        'failure_rate()',
        `avg(${SpanFields.SPAN_DURATION})`,
        `p95(${SpanFields.SPAN_DURATION})`,
        `sum(${SpanFields.SPAN_DURATION})`,
      ],
      columns: [SpanFields.COMMAND],
      aggregates: [
        'count()',
        'failure_rate()',
        `avg(${SpanFields.SPAN_DURATION})`,
        `p95(${SpanFields.SPAN_DURATION})`,
        `sum(${SpanFields.SPAN_DURATION})`,
      ],
      fieldAliases: [
        t('Command'),
        t('Invocations'),
        t('Error Rate'),
        t('Avg'),
        t('P95'),
        t('Time Spent'),
      ],
      orderby: '-count()',
    },
  ],
  layout: {
    x: 0,
    y: 9,
    w: 6,
    h: 2,
    minH: 2,
  },
};

const JOBS_TABLE: Widget = {
  id: 'jobs-table',
  title: t('Jobs'),
  displayType: DisplayType.TABLE,
  widgetType: WidgetType.SPANS,
  interval: '5m',
  queries: [
    {
      name: '',
      conditions: `${SpanFields.SPAN_OP}:queue.process`,
      fields: [
        SpanFields.TRANSACTION,
        SpanFields.MESSAGING_MESSAGE_DESTINATION_NAME,
        'count()',
        'failure_rate()',
        `avg(${SpanFields.MESSAGING_MESSAGE_RECEIVE_LATENCY})`,
        `avg_if(${SpanFields.SPAN_DURATION},${SpanFields.SPAN_OP},equals,queue.process)`,
        `sum(${SpanFields.SPAN_DURATION})`,
      ],
      columns: [SpanFields.MESSAGING_MESSAGE_DESTINATION_NAME, 'transaction'],
      aggregates: [
        'count()',
        'failure_rate()',
        `avg(${SpanFields.MESSAGING_MESSAGE_RECEIVE_LATENCY})`,
        `avg_if(${SpanFields.SPAN_DURATION},${SpanFields.SPAN_OP},equals,queue.process)`,
        `sum(${SpanFields.SPAN_DURATION})`,
      ],
      fieldAliases: [
        t('Job'),
        t('Queue Name'),
        t('Processed'),
        t('Error Rate'),
        t('Avg Time in Queue'),
        t('Avg Processing Time'),
        t('Time Spent'),
      ],
      orderby: '-count()',
    },
  ],
  layout: {
    x: 0,
    y: 11,
    w: 6,
    h: 2,
    minH: 2,
  },
};

export const LARAVEL_OVERVIEW_PREBUILT_CONFIG: PrebuiltDashboard = {
  filters: {
    globalFilter: [
      {
        dataset: WidgetType.SPANS,
        tag: {
          key: SpanFields.TRANSACTION,
          name: SpanFields.TRANSACTION,
          kind: FieldKind.TAG,
        },
        value: '',
      },
    ],
  },
  dateCreated: '',
  projects: [],
  title: DASHBOARD_TITLE,
  widgets: [
    ...BACKEND_OVERVIEW_FIRST_ROW_WIDGETS,
    ...BACKEND_OVERVIEW_SECOND_ROW_WIDGETS,
    PATHS_TABLE,
    COMMANDS_TABLE,
    JOBS_TABLE,
  ],
};
