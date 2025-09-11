import type {ValidSort} from 'sentry/views/prevent/tests/testAnalyticsTable/testAnalyticsTable';

export const DEFAULT_SORT: ValidSort = {
  field: 'totalFailCount',
  kind: 'desc',
};
