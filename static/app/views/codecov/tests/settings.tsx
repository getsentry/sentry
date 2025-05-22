import type {ValidSort} from 'sentry/views/codecov/tests/testAnalyticsTable/testAnalyticsTable';

export const DEFAULT_SORT: ValidSort = {
  field: 'commitsFailed',
  kind: 'desc',
};
