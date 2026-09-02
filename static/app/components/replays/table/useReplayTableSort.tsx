import {useCallback} from 'react';
import {useQueryState} from 'nuqs';

import {getNextSort} from 'sentry/components/tables/getNextSort';
import {trackAnalytics} from 'sentry/utils/analytics';
import {encodeSort} from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {parseAsSort} from 'sentry/utils/url/parseAsSort';
import {useOrganization} from 'sentry/utils/useOrganization';

const DECODED_DEFAULT_REPLAY_LIST_SORT: Sort = {field: 'started_at', kind: 'desc'};
export const DEFAULT_REPLAY_LIST_SORT = encodeSort(DECODED_DEFAULT_REPLAY_LIST_SORT);

export function useReplayTableSort() {
  const organization = useOrganization();

  const [sort, setSort] = useQueryState(
    'sort',
    parseAsSort
      .withDefault(DECODED_DEFAULT_REPLAY_LIST_SORT)
      .withOptions({history: 'push', throttleMs: 0})
  );

  const handleSortClick = useCallback(
    (key: string) => {
      setSort(getNextSort(key, sort));

      trackAnalytics('replay.list-sorted', {
        organization,
        column: key,
      });
    },
    [organization, setSort, sort]
  );

  return {
    sortType: sort,
    sortQuery: encodeSort(sort),
    onSortClick: handleSortClick,
  };
}
