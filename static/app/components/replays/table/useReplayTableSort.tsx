import {useCallback} from 'react';

import {trackAnalytics} from 'sentry/utils/analytics';
import {encodeSort} from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {decodeSorts} from 'sentry/utils/queryString';
import useUrlParams from 'sentry/utils/url/useUrlParams';
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

  const {getParamValue, setParamValue} = useUrlParams(queryParamKey, '');
  const sortQuery = getParamValue();
  const sortType = decodeSorts(sortQuery).at(0) ?? defaultSort;

  const handleSortClick = useCallback(
    (key: string) => {
      const newSort = {
        field: key,
        kind:
          key === sortType.field ? (sortType.kind === 'asc' ? 'desc' : 'asc') : 'desc',
      } satisfies Sort;

      setParamValue(encodeSort(newSort));

      trackAnalytics('replay.list-sorted', {
        organization,
        column: key,
      });
    },
    [organization, setParamValue, sortType]
  );

  return {
    sortType,
    sortQuery,
    onSortClick: handleSortClick,
  };
}
