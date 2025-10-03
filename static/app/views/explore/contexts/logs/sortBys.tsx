import type {Location} from 'history';

import {defined} from 'sentry/utils';
import type {Sort} from 'sentry/utils/discover/fields';
import {LOGS_CURSOR_KEY} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';

export const LOGS_SORT_BYS_KEY = 'logsSortBys';
export const LOGS_AGGREGATE_SORT_BYS_KEY = 'logsAggregateSortBys';

export const logsTimestampDescendingSortBy: Sort = {
  field: OurLogKnownFieldKey.TIMESTAMP,
  kind: 'desc' as const,
};

export const logsTimestampAscendingSortBy: Sort = {
  field: OurLogKnownFieldKey.TIMESTAMP,
  kind: 'asc' as const,
};

export function updateLocationWithLogSortBys(
  location: Location,
  sortBys: Sort[] | null | undefined
) {
  if (defined(sortBys)) {
    location.query[LOGS_SORT_BYS_KEY] = sortBys.map(sortBy =>
      sortBy.kind === 'desc' ? `-${sortBy.field}` : sortBy.field
    );

    // make sure to clear the cursor every time the query is updated
    delete location.query[LOGS_CURSOR_KEY];
  } else if (sortBys === null) {
    delete location.query[LOGS_SORT_BYS_KEY];
  }
}
