import type {AlertConfig} from 'sentry/views/insights/common/components/chartPanel';

export const ALERTS: Record<string, AlertConfig> = {
  duration: {
    aggregate: 'avg(d:spans/exclusive_time@millisecond)',
    query: 'span.module:db has:span.description',
  },
  spm: {
    aggregate: 'spm()',
    query: 'span.module:db has:span.description',
  },
};
