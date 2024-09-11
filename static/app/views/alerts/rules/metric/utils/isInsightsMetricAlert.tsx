import {parseField} from 'sentry/utils/metrics/mri';

export const INSIGHTS_METRICS_OPERATIONS_WITHOUT_ARGS = [
  {
    label: 'spm',
    value: 'spm',
    mri: 'd:spans/duration@millisecond',
  },
  {
    label: 'cache_miss_rate',
    value: 'cache_miss_rate',
    mri: 'd:spans/duration@millisecond',
  },
];

export const INSIGHTS_METRICS_OPERATIONS_WITH_CUSTOM_ARGS = [
  {
    label: 'http_response_rate',
    value: 'http_response_rate',
    options: [
      {label: '3', value: '3'},
      {label: '4', value: '4'},
      {label: '5', value: '5'},
    ],
    mri: 'd:spans/duration@millisecond',
  },
  {
    label: 'performance_score',
    value: 'performance_score',
    options: [
      {label: 'measurements.score.lcp', value: 'measurements.score.lcp'},
      {label: 'measurements.score.fcp', value: 'measurements.score.fcp'},
      {label: 'measurements.score.inp', value: 'measurements.score.inp'},
      {label: 'measurements.score.cls', value: 'measurements.score.cls'},
      {label: 'measurements.score.ttfb', value: 'measurements.score.ttfb'},
      {label: 'measurements.score.total', value: 'measurements.score.total'},
    ],
    mri: 'd:transactions/measurements.score.total@ratio',
  },
];

export const INSIGHTS_METRICS_OPERATIONS = [
  ...INSIGHTS_METRICS_OPERATIONS_WITH_CUSTOM_ARGS,
  ...INSIGHTS_METRICS_OPERATIONS_WITHOUT_ARGS,
];

export const INSIGHTS_METRICS = [
  'd:spans/webvital.inp@millisecond',
  'd:spans/duration@millisecond',
  'd:spans/exclusive_time@millisecond',
  'd:spans/http.response_content_length@byte',
  'd:spans/http.decoded_response_content_length@byte',
  'd:spans/http.response_transfer_size@byte',
  'd:spans/cache.item_size@byte',
  'g:spans/messaging.message.receive.latency@millisecond',
  'g:spans/mobile.frames_delay@second',
  'g:spans/mobile.total_frames@none',
  'g:spans/mobile.frozen_frames@none',
  'g:spans/mobile.slow_frames@none',
  'c:spans/ai.total_tokens.used@none',
  'c:spans/ai.total_cost@usd',
  'd:transactions/measurements.score.lcp@ratio',
  'd:transactions/measurements.score.fcp@ratio',
  'd:transactions/measurements.score.cls@ratio',
  'd:transactions/measurements.score.ttfb@ratio',
  'd:transactions/measurements.score.inp@ratio',
  'd:transactions/measurements.score.total@ratio',
];

export const isInsightsMetricAlert = (aggregate: string) => {
  const {mri, aggregation} = parseField(aggregate) ?? {};
  if (
    INSIGHTS_METRICS.includes(mri as string) ||
    INSIGHTS_METRICS_OPERATIONS.map(({value}) => value).includes(aggregation as string)
  ) {
    return true;
  }
  return false;
};
