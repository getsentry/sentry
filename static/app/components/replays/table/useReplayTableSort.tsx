import {useCallback, useRef} from 'react';

import {trackAnalytics} from 'sentry/utils/analytics';
import {encodeSort} from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {decodeSorts} from 'sentry/utils/queryString';
import useOrganization from 'sentry/utils/useOrganization';
import useUrlParams from 'sentry/utils/useUrlParams';

interface Props {
  defaultSort?: Sort;
  queryParamKey?: string;
}

const DEFAULT_SORT = {field: 'started_at', kind: 'asc'} as const;

export default function useReplayTableSort({
  defaultSort = DEFAULT_SORT,
  queryParamKey = 'sort',
}: Props = {}) {
  const defaultSortRef = useRef(defaultSort);
  const organization = useOrganization();

  const {getParamValue, setParamValue} = useUrlParams(queryParamKey, '-started_at');
  const sortQuery = getParamValue();
  const sortType = decodeSorts(sortQuery).at(0) ?? defaultSortRef.current;

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
