import {t} from 'sentry/locale';
import {DisplayType, WidgetType, type Widget} from 'sentry/views/dashboards/types';
import type {PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {QUEUE_CHARTS} from 'sentry/views/dashboards/utils/prebuiltConfigs/queues/queueCharts';
import {SUMMARY_DASHBOARD_TITLE} from 'sentry/views/dashboards/utils/prebuiltConfigs/queues/settings';
import {spaceWidgetsEquallyOnRow} from 'sentry/views/dashboards/utils/prebuiltConfigs/utils/spaceWidgetsEquallyOnRow';
import {ModuleName, SpanFields} from 'sentry/views/insights/types';

const SPAN_OP_FILTER = `${SpanFields.SPAN_OP}:[queue.process,queue.publish]`;

const FIRST_ROW_WIDGTS = spaceWidgetsEquallyOnRow(
  [
    {
      id: 'avg-time-in-queue-widget',
      title: t('Avg Time in Queue'),
      displayType: DisplayType.BIG_NUMBER,
      widgetType: WidgetType.SPANS,
      interval: '5m',
      queries: [
        {
          name: '',
          fields: [`avg(${SpanFields.MESSAGING_MESSAGE_RECEIVE_LATENCY})`],
          aggregates: [`avg(${SpanFields.MESSAGING_MESSAGE_RECEIVE_LATENCY})`],
          columns: [],
          conditions: SPAN_OP_FILTER,
          orderby: `avg(${SpanFields.MESSAGING_MESSAGE_RECEIVE_LATENCY})`,
        },
      ],
    },
    {
      id: 'avg-processing-time-widget',
      title: t('Avg Processing Time'),
      displayType: DisplayType.BIG_NUMBER,
      widgetType: WidgetType.SPANS,
      interval: '5m',
      queries: [
        {
          name: '',
          fields: [
            `equation|avg_if(${SpanFields.SPAN_DURATION},${SpanFields.SPAN_OP},equals,queue.process)`,
          ],
          aggregates: [
            `equation|avg_if(${SpanFields.SPAN_DURATION},${SpanFields.SPAN_OP},equals,queue.process)`,
          ],
          columns: [],
          conditions: SPAN_OP_FILTER,
          orderby: `equation|avg_if(${SpanFields.SPAN_DURATION},${SpanFields.SPAN_OP},equals,queue.process)`,
        },
      ],
    },
    {
      id: 'error-rate-widget',
      title: t('Error Rate'),
      displayType: DisplayType.BIG_NUMBER,
      widgetType: WidgetType.SPANS,
      interval: '5m',
      queries: [
        {
          name: '',
          fields: [
            `equation|1 - (count_if(${SpanFields.TRACE_STATUS},equals,ok) / count(${SpanFields.SPAN_DURATION}))`,
          ],
          aggregates: [
            `equation|1 - (count_if(${SpanFields.TRACE_STATUS},equals,ok) / count(${SpanFields.SPAN_DURATION}))`,
          ],
          columns: [],
          conditions: SPAN_OP_FILTER,
          fieldMeta: [{valueType: 'percentage', valueUnit: null}],
          orderby: `equation|1 - (count_if(${SpanFields.TRACE_STATUS},equals,ok) / count(${SpanFields.SPAN_DURATION}))`,
        },
      ],
    },
    {
      id: 'published-widget',
      title: t('Published'),
      displayType: DisplayType.BIG_NUMBER,
      widgetType: WidgetType.SPANS,
      interval: '5m',
      queries: [
        {
          name: '',
          fields: [`equation|count_if(${SpanFields.SPAN_OP},equals,queue.publish)`],
          aggregates: [`equation|count_if(${SpanFields.SPAN_OP},equals,queue.publish)`],
          columns: [],
          conditions: SPAN_OP_FILTER,
          orderby: `equation|count_if(${SpanFields.SPAN_OP},equals,queue.publish)`,
        },
      ],
    },
    {
      id: 'processed-widget',
      title: t('Processed'),
      displayType: DisplayType.BIG_NUMBER,
      widgetType: WidgetType.SPANS,
      interval: '5m',
      queries: [
        {
          name: '',
          fields: [`equation|count_if(${SpanFields.SPAN_OP},equals,queue.process)`],
          aggregates: [`equation|count_if(${SpanFields.SPAN_OP},equals,queue.process)`],
          columns: [],
          conditions: SPAN_OP_FILTER,
          orderby: `equation|count_if(${SpanFields.SPAN_OP},equals,queue.process)`,
        },
      ],
    },
    {
      id: 'time-spent-widget',
      title: t('Time Spent'),
      displayType: DisplayType.BIG_NUMBER,
      widgetType: WidgetType.SPANS,
      interval: '5m',
      queries: [
        {
          name: '',
          fields: [`sum(${SpanFields.SPAN_DURATION})`],
          aggregates: [`sum(${SpanFields.SPAN_DURATION})`],
          columns: [],
          conditions: SPAN_OP_FILTER,
          orderby: `sum(${SpanFields.SPAN_DURATION})`,
        },
      ],
    },
  ],
  0,
  {h: 1, minH: 1}
);

const SECOND_ROW_WIDGETS = spaceWidgetsEquallyOnRow([...QUEUE_CHARTS], 1);

const PRODUCER_TABLE: Widget = {
  id: 'producer-table',
  title: t('Producer Transactions'),
  displayType: DisplayType.TABLE,
  widgetType: WidgetType.SPANS,
  interval: '5m',
  queries: [
    {
      name: '',
      fields: [
        SpanFields.TRANSACTION,
        `equation|1 - (count_if(${SpanFields.TRACE_STATUS},equals,ok) / count(${SpanFields.SPAN_DURATION}))`,
        `equation|count_if(${SpanFields.SPAN_OP},equals,queue.publish)`,
        `sum(${SpanFields.SPAN_DURATION})`,
      ],
      aggregates: [
        `equation|1 - (count_if(${SpanFields.TRACE_STATUS},equals,ok) / count(${SpanFields.SPAN_DURATION}))`,
        `equation|count_if(${SpanFields.SPAN_OP},equals,queue.publish)`,
        `sum(${SpanFields.SPAN_DURATION})`,
      ],
      columns: [SpanFields.TRANSACTION],
      fieldAliases: [t('Transaction'), t('Error rate'), t('Published'), t('Time spent')],
      fieldMeta: [null, {valueType: 'percentage', valueUnit: null}, null, null],
      conditions: `${SpanFields.SPAN_OP}:queue.publish`,
      orderby: `-sum(${SpanFields.SPAN_DURATION})`,
    },
  ],
  layout: {
    x: 0,
    y: 7,
    w: 6,
    h: 3,
    minH: 3,
  },
};

const CONSUMER_TABLE: Widget = {
  id: 'consumer-table',
  title: t('Consumer Transactions'),
  displayType: DisplayType.TABLE,
  widgetType: WidgetType.SPANS,
  interval: '5m',
  queries: [
    {
      name: '',
      fields: [
        SpanFields.TRANSACTION,
        `avg(${SpanFields.MESSAGING_MESSAGE_RECEIVE_LATENCY})`,
        `equation|avg_if(${SpanFields.SPAN_DURATION},${SpanFields.SPAN_OP},equals,queue.process)`,
        `equation|1 - (count_if(${SpanFields.TRACE_STATUS},equals,ok) / count(${SpanFields.SPAN_DURATION}))`,
        `equation|count_if(${SpanFields.SPAN_OP},equals,queue.process)`,
        `sum(${SpanFields.SPAN_DURATION})`,
      ],
      aggregates: [
        `avg(${SpanFields.MESSAGING_MESSAGE_RECEIVE_LATENCY})`,
        `equation|avg_if(${SpanFields.SPAN_DURATION},${SpanFields.SPAN_OP},equals,queue.process)`,
        `equation|1 - (count_if(${SpanFields.TRACE_STATUS},equals,ok) / count(${SpanFields.SPAN_DURATION}))`,
        `equation|count_if(${SpanFields.SPAN_OP},equals,queue.process)`,
        `sum(${SpanFields.SPAN_DURATION})`,
      ],
      columns: [SpanFields.TRANSACTION],
      fieldAliases: [
        t('Transaction'),
        t('Avg time in queue'),
        t('Avg processing time'),
        t('Error rate'),
        t('Processed'),
        t('Time spent'),
      ],
      fieldMeta: [
        null,
        null,
        null,
        {valueType: 'percentage', valueUnit: null},
        null,
        null,
      ],
      conditions: `${SpanFields.SPAN_OP}:queue.process`,
      orderby: `-sum(${SpanFields.SPAN_DURATION})`,
    },
  ],
  layout: {
    x: 0,
    y: 4,
    w: 6,
    h: 3,
    minH: 3,
  },
};

export const QUEUE_SUMMARY_PREBUILT_CONFIG: PrebuiltDashboard = {
  hidden: true,
  dateCreated: '',
  projects: [],
  title: SUMMARY_DASHBOARD_TITLE,
  filters: {},
  widgets: [...FIRST_ROW_WIDGTS, ...SECOND_ROW_WIDGETS, CONSUMER_TABLE, PRODUCER_TABLE],
  onboarding: {type: 'module', moduleName: ModuleName.QUEUE},
};
