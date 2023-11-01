import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';

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
  | 'avg(http.transfer_size)';

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
  'avg(http.transfer_size)': t('Avg Transfer Size'),
};

export const getThroughputTitle = (spanOp?: string) => {
  if (spanOp?.startsWith('db')) {
    return t('Queries Per Min');
  }
  if (defined(spanOp)) {
    return t('Requests');
  }
  return '--';
};

export const getDurationChartTitle = (spanOp?: string) => {
  if (spanOp) {
    return t('Average Duration');
  }

  return '--';
};

export const getThroughputChartTitle = (spanOp?: string) => {
  if (spanOp?.startsWith('db')) {
    return t('Queries Per Minute');
  }
  if (spanOp) {
    return t('Requests Per Minute');
  }
  return '--';
};
