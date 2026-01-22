export enum Referrer {
  // based on https://github.com/getsentry/sentry/blob/1dd8b8de9a99672301ee8eb2f852ac42b3a87e62/src/sentry/snuba/referrer.py#L457-L458
  SCREENS_SPAN_METRICS = 'api.insights.mobile-screens-span-metrics',
  SCREENS_METRICS = 'api.insights.mobile-screens-metrics',
  SCREENS_SCREEN_TABLE_SPAN_METRICS = 'api.insights.mobile-screens-screen-table-span-metrics',
}
