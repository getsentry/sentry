import {t} from 'sentry/locale';
import type {AlertConfig} from 'sentry/views/insights/common/components/chartPanel';
import {SpanMetricsField} from 'sentry/views/insights/types';

export const ALERTS: Record<string, AlertConfig> = {
  latency: {
    aggregate: `avg(g:spans/${SpanMetricsField.MESSAGING_MESSAGE_RECEIVE_LATENCY}@millisecond)`,
    query: 'span.op:queue.process',
    name: t('Create Time in Queue Alert'),
  },
  duration: {
    aggregate: 'avg(d:spans/duration@millisecond)',
    query: 'span.op:queue.process',
    name: t('Create Processing Time Alert'),
  },
  processed: {
    aggregate: 'spm()',
    query: 'span.op:queue.process',
    name: t('Create Processed Alert'),
  },
  published: {
    aggregate: 'spm()',
    query: 'span.op:queue.publish',
    name: t('Create Published Alert'),
  },
};
