import {t} from 'sentry/locale';
import {FieldKind} from 'sentry/utils/fields';
import {DisplayType, WidgetType, type Widget} from 'sentry/views/dashboards/types';
import type {PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {QUEUE_CHARTS} from 'sentry/views/dashboards/utils/prebuiltConfigs/queues/queueCharts';
import {DASHBOARD_TITLE} from 'sentry/views/dashboards/utils/prebuiltConfigs/queues/settings';
import {spaceWidgetsEquallyOnRow} from 'sentry/views/dashboards/utils/prebuiltConfigs/utils/spaceWidgetsEquallyOnRow';
import {SpanFields} from 'sentry/views/insights/types';

const FIRST_ROW_WIDGETS = spaceWidgetsEquallyOnRow([...QUEUE_CHARTS], 0);

const DESTINATION_TABLE: Widget = {
  id: 'destination-table',
  title: t('Destinations'),
  displayType: DisplayType.TABLE,
  widgetType: WidgetType.SPANS,
  interval: '5m',
  queries: [
    {
      name: '',
      fields: [
        SpanFields.MESSAGING_MESSAGE_DESTINATION_NAME,
        `avg(${SpanFields.MESSAGING_MESSAGE_RECEIVE_LATENCY})`,
        `avg_if(${SpanFields.SPAN_DURATION},${SpanFields.SPAN_OP},equals,queue.process)`,
        `equation|1 - (count_if(${SpanFields.TRACE_STATUS},equals,ok) / count(${SpanFields.SPAN_DURATION}))`,
        `count_if(${SpanFields.SPAN_OP},equals,queue.publish)`,
        `count_if(${SpanFields.SPAN_OP},equals,queue.process)`,
        `sum(${SpanFields.SPAN_DURATION})`,
      ],
      columns: [SpanFields.MESSAGING_MESSAGE_DESTINATION_NAME],
      aggregates: [
        `avg(${SpanFields.MESSAGING_MESSAGE_RECEIVE_LATENCY})`,
        `avg_if(${SpanFields.SPAN_DURATION},${SpanFields.SPAN_OP},equals,queue.process)`,
        `equation|1 - (count_if(${SpanFields.TRACE_STATUS},equals,ok) / count(${SpanFields.SPAN_DURATION}))`,
        `count_if(${SpanFields.SPAN_OP},equals,queue.publish)`,
        `count_if(${SpanFields.SPAN_OP},equals,queue.process)`,
        `sum(${SpanFields.SPAN_DURATION})`,
      ],
      fieldAliases: [
        t('Destination'),
        t('Avg time in queue'),
        t('Avg processing time'),
        t('Error rate'),
        t('Published'),
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
        null,
      ],
      linkedDashboards: [
        {
          dashboardId: '-1',
          field: SpanFields.MESSAGING_MESSAGE_DESTINATION_NAME,
          staticDashboardId: 27,
        },
      ],
      conditions: `${SpanFields.SPAN_OP}:[queue.publish, queue.process]`,
      orderby: `-sum(${SpanFields.SPAN_DURATION})`,
    },
  ],
  layout: {
    x: 0,
    y: 3,
    w: 6,
    h: 6,
    minH: 6,
  },
};

export const QUEUES_PREBUILT_CONFIG: PrebuiltDashboard = {
  dateCreated: '',
  projects: [],
  title: DASHBOARD_TITLE,
  filters: {
    globalFilter: [
      {
        dataset: WidgetType.SPANS,
        tag: {
          key: SpanFields.MESSAGING_MESSAGE_DESTINATION_NAME,
          name: SpanFields.MESSAGING_MESSAGE_DESTINATION_NAME,
          kind: FieldKind.TAG,
        },
        value: '',
      },
    ],
  },
  widgets: [...FIRST_ROW_WIDGETS, DESTINATION_TABLE],
};
