import {useCallback} from 'react';
import {useQueryState} from 'nuqs';

import {trackAnalytics} from 'sentry/utils/analytics';
import {encodeSort} from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import parseAsSort from 'sentry/utils/url/parseAsSort';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  defaultSort?: Sort;
  queryParamKey?: string;
}

const DECODED_DEFAULT_REPLAY_LIST_SORT: Sort = {field: 'started_at', kind: 'desc'};
export const DEFAULT_REPLAY_LIST_SORT = encodeSort(DECODED_DEFAULT_REPLAY_LIST_SORT);

export default function useReplayTableSort({
  defaultSort = DECODED_DEFAULT_REPLAY_LIST_SORT,
  queryParamKey = 'sort',
}: Props = {}) {
  const organization = useOrganization();

  const [sort, setSort] = useQueryState(
    queryParamKey,
    parseAsSort.withDefault(defaultSort).withOptions({history: 'push', throttleMs: 0})
  );

  const handleSortClick = useCallback(
    (key: string) => {
      const newSort = {
        field: key,
        kind: key === sort.field ? (sort.kind === 'asc' ? 'desc' : 'asc') : 'desc',
      } satisfies Sort;

      setSort(newSort);

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
