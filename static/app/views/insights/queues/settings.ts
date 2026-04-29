import {t} from 'sentry/locale';

export const MODULE_TITLE = t('Queues');
export const BASE_URL = 'queues';
export const DATA_TYPE = t('Queue');
export const DATA_TYPE_PLURAL = t('Queues');

export const FIELD_ALIASES = {
  'epm() : span.op : queue.publish': t('Published'),
  'epm() : span.op : queue.process': t('Processed'),
  'avg(messaging.message.receive.latency)': t('Average Time in Queue'),
  'avg(span.duration)': t('Average Processing Time'),
};

export const MODULE_DOC_LINK =
  'https://docs.sentry.io/product/insights/backend/queue-monitoring/';

export const MODULE_FEATURES = ['insight-modules'];
