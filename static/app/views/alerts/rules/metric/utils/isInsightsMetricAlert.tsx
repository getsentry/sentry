import {parseField} from 'sentry/utils/metrics/mri';

export const INSIGHTS_METRICS_OPERATIONS = [
  {
    label: 'spm',
    value: 'spm',
  },
  {
    label: 'cache_miss_rate',
    value: 'cache_miss_rate',
  },
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
