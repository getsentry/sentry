import {t} from 'sentry/locale';
import type {AlertConfig} from 'sentry/views/insights/common/components/chartPanel';

export const ALERTS: Record<string, AlertConfig> = {
  missRate: {
    aggregate: 'cache_miss_rate()',
    query: 'span.op:[cache.get_item,cache.get]',
  },
  spm: {
    aggregate: 'spm()',
    query: 'span.op:[cache.get_item,cache.get]',
  },
  duration: {
    aggregate: 'avg(transaction.duration)',
    name: t('Create Average Duration Alert'),
  },
};
