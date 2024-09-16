import type {AlertConfig} from 'sentry/views/insights/common/components/chartPanel';
import {SpanMetricsField} from 'sentry/views/insights/types';

export const ALERTS: Record<string, AlertConfig> = {
  spm: {
    aggregate: 'spm()',
  },
  duration: {
    aggregate: 'avg(d:spans/duration@millisecond)',
  },
  tokensUsed: {
    aggregate: `sum(c:spans/${SpanMetricsField.AI_TOTAL_TOKENS_USED}@none)`,
  },
};
