export const TABLE_FIELD_NAME_TO_SORT_KEY = {
  averageDurationMs: 'AVG_DURATION',
  flakeRate: 'FLAKE_RATE',
  commitsFailed: 'COMMITS_WHERE_FAIL',
  lastRun: 'UPDATED_AT',
  testName: 'NAME',
};

export const SUMMARY_TO_TABLE_FILTER_KEY = {
  slowestTests: 'SLOWEST_TESTS',
  flakyTests: 'FLAKY_TESTS',
  failedTests: 'FAILED_TESTS',
  skippedTests: 'SKIPPED_TESTS',
  uncoveredLines: 'UNCOVERED_LINES',
  indirectChanges: 'INDIRECT_CHANGES',
  filesChanged: 'FILES_CHANGED',
  uploadsCount: 'UPLOAD_COUNT',
};

export type SummaryFilterKey = keyof typeof SUMMARY_TO_TABLE_FILTER_KEY;

export const DATE_TO_QUERY_INTERVAL = {
  '24h': 'INTERVAL_1_DAY',
  '7d': 'INTERVAL_7_DAY',
  '30d': 'INTERVAL_30_DAY',
};
