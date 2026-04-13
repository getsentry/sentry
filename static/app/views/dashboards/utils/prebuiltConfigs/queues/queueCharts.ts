import {t} from 'sentry/locale';
import {DisplayType, WidgetType, type Widget} from 'sentry/views/dashboards/types';
import {SpanFields} from 'sentry/views/insights/types';

export const QUEUE_CHARTS: Widget[] = [
  {
    id: 'average-duration-widget',
    title: t('Average Duration'),
    displayType: DisplayType.AREA,
    widgetType: WidgetType.SPANS,
    interval: '5m',
    queries: [
      {
        name: '',
        aggregates: [
          `avg(${SpanFields.MESSAGING_MESSAGE_RECEIVE_LATENCY})`,
          `avg(${SpanFields.SPAN_DURATION})`,
        ],
        columns: [],
        fields: [
          `avg(${SpanFields.MESSAGING_MESSAGE_RECEIVE_LATENCY})`,
          `avg(${SpanFields.SPAN_DURATION})`,
        ],
        conditions: `${SpanFields.SPAN_OP}:queue.process`,
        orderby: `avg(${SpanFields.SPAN_DURATION})`,
      },
    ],
  },
  {
    id: 'throughput-widget',
    title: t('Published vs Processed'),
    displayType: DisplayType.LINE,
    widgetType: WidgetType.SPANS,
    interval: '5m',
    queries: [
      {
        name: '',
        aggregates: ['epm()'],
        fields: ['epm()'],
        columns: [SpanFields.SPAN_OP],
        conditions: `${SpanFields.SPAN_OP}:[queue.publish, queue.process]`,
        orderby: 'epm()',
      },
    ],
  },
];
