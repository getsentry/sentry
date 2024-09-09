import {t} from 'sentry/locale';
import type {AlertConfig} from 'sentry/views/insights/common/components/chartPanel';
import {SpanMetricsField} from 'sentry/views/insights/types';

export const ALERTS: Record<string, AlertConfig> = {
  spm: {
    aggregate: 'spm()',
  },
  duration: {
    aggregate: 'avg(d:spans/duration@millisecond)',
  },
  decodedSize: {
    aggregate: `avg(d:spans/${SpanMetricsField.HTTP_DECODED_RESPONSE_CONTENT_LENGTH}@byte)`,
    name: t('Create Decoded Size Alert'),
  },
  transferSize: {
    aggregate: `avg(d:spans/${SpanMetricsField.HTTP_RESPONSE_TRANSFER_SIZE}@byte)`,
    name: t('Create Transfer Size Alert'),
  },
  encodedSize: {
    aggregate: `avg(d:spans/${SpanMetricsField.HTTP_RESPONSE_CONTENT_LENGTH}@byte)`,
    name: t('Create Encoded Size Alert'),
  },
};
