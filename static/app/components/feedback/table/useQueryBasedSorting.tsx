import {useMemo} from 'react';
import type {Location} from 'history';
import first from 'lodash/first';

import queryBasedSortLinkGenerator from 'sentry/components/feedback/table/queryBasedSortLinkGenerator';
import {GridColumnOrder} from 'sentry/components/gridEditable';
import {fromSorts} from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';

interface Props {
  defaultSort: Sort;
  location: Location<{sort?: undefined | string}>;
  // prefix?: string;
}

export default function useQueryBasedSorting({
  location,
  defaultSort /* prefix */,
}: Props) {
  /// const pre = prefix ?? '';
  const sorts = useMemo(
    () => fromSorts(/* location.query[pre + 'sort'] */ location.query.sort),
    [/* location.query, pre */ location.query.sort]
  );
  const currentSort = useMemo(() => first(sorts) ?? defaultSort, [defaultSort, sorts]);

  return {
    makeSortLinkGenerator: (column: GridColumnOrder) =>
      queryBasedSortLinkGenerator(location, column, currentSort /* pre */),
    currentSort,
  };
}
