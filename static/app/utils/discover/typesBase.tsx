export enum DisplayModes {
  DEFAULT = 'default',
  PREVIOUS = 'previous',
  TOP5 = 'top5',
  DAILY = 'daily',
  DAILYTOP5 = 'dailytop5',
  BAR = 'bar',
}
export enum DiscoverDatasets {
  DISCOVER = 'discover',
  ERRORS = 'errors',
  METRICS = 'metrics',
  METRICS_ENHANCED = 'metricsEnhanced',
  ISSUE_PLATFORM = 'issuePlatform',
  OURLOGS = 'ourlogs',
  PREPROD_SIZE = 'preprodSize',
  SPANS = 'spans',
  TRANSACTIONS = 'transactions',
  TRACEMETRICS = 'tracemetrics',
}
export enum SavedQueryDatasets {
  DISCOVER = 'discover',
  ERRORS = 'error-events',
  TRANSACTIONS = 'transaction-like',
}
export enum DatasetSource {
  USER = 'user',
  UNKNOWN = 'unknown',
  INFERRED = 'inferred',
  FORCED = 'forced',
  SPAN_MIGRATION = 'span_migration_version_1',
  SPAN_MIGRATION_V2 = 'span_migration_version_2',
}
