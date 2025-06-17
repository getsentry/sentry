export const TABLE_FIELD_NAME_TO_SORT_KEY = {
  averageDurationMs: 'AVG_DURATION',
  flakeRate: 'FLAKE_RATE',
  commitsFailed: 'COMMITS_WHERE_FAIL',
  lastRun: 'UPDATED_AT',
  testName: 'NAME',
};

export const SUMMARY_TO_TA_TABLE_FILTER_KEY = {
  slowestTests: 'SLOWEST_TESTS',
  flakyTests: 'FLAKY_TESTS',
  failedTests: 'FAILED_TESTS',
  skippedTests: 'SKIPPED_TESTS',
};

export type SummaryTAFilterKey = keyof typeof SUMMARY_TO_TA_TABLE_FILTER_KEY;

export const SUMMARY_TO_COMMITS_TABLE_FILTER_KEY = {
  uncoveredLines: 'UNCOVERED_LINES',
  indirectChanges: 'INDIRECT_CHANGES',
  filesChanged: 'FILES_CHANGED',
  uploadsCount: 'UPLOAD_COUNT',
};

type SummaryCommitsFilterKey = keyof typeof SUMMARY_TO_COMMITS_TABLE_FILTER_KEY;

export type SummaryFilterKey = SummaryTAFilterKey | SummaryCommitsFilterKey;

export const DATE_TO_QUERY_INTERVAL = {
  '24h': 'INTERVAL_1_DAY',
  '7d': 'INTERVAL_7_DAY',
  '30d': 'INTERVAL_30_DAY',
};
