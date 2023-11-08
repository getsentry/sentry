import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {RATE_UNIT_TITLE, RateUnits} from 'sentry/utils/discover/fields';

export type DataKey =
  | 'change'
  | 'timeSpent'
  | 'p50p95'
  | 'p50'
  | 'p95'
  | 'avg'
  | 'throughput'
  | 'duration'
  | 'errorCount'
  | 'slowFrames'
  | 'ttid'
  | 'ttfd'
  | 'count'
  | 'avg(http.response_content_length)'
  | 'avg(http.decoded_response_content_length)'
  | 'avg(http.response_transfer_size)';

export const DataTitles: Record<DataKey, string> = {
  change: t('Change'),
  timeSpent: t('Time Spent'),
  p50p95: t('Duration (P50, P95)'),
  p50: t('Duration (P50)'),
  p95: t('Duration (P95)'),
  avg: t('Avg Duration'),
  duration: t('Duration'),
  errorCount: t('5XX Responses'),
  throughput: t('Throughput'),
  count: t('Count'),
  slowFrames: t('Slow Frames %'),
  ttid: t('Time To Initial Display'),
  ttfd: t('Time To Full Display'),
  'avg(http.response_content_length)': t('Avg Encoded Size'),
  'avg(http.decoded_response_content_length)': t('Avg Decoded Size'),
  'avg(http.response_transfer_size)': t('Avg Transfer Size'),
};

export const getThroughputTitle = (
  spanOp?: string,
  throughputUnit = RateUnits.PER_MINUTE
) => {
  if (spanOp?.startsWith('db')) {
    return `${t('Queries')} ${RATE_UNIT_TITLE[throughputUnit]}`;
  }
  if (defined(spanOp)) {
    return `${t('Requests')} ${RATE_UNIT_TITLE[throughputUnit]}`;
  }
  return '--';
};

export const getDurationChartTitle = (spanOp?: string) => {
  if (spanOp) {
    return t('Average Duration');
  }

  return '--';
};

export const getThroughputChartTitle = (
  spanOp?: string,
  throughputUnit = RateUnits.PER_MINUTE
) => {
  if (spanOp?.startsWith('db')) {
    return `${t('Queries')} ${RATE_UNIT_TITLE[throughputUnit]}`;
  }
  if (spanOp) {
    return `${t('Requests')} ${RATE_UNIT_TITLE[throughputUnit]}`;
  }
  return '--';
};
