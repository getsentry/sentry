export const EXCLUDE_SPAN_METRICS_QUERY =
  '(!has:sentry.metric.source OR !sentry.metric.source:span)';
