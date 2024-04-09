import {useMemo} from 'react';
import type {Location} from 'history';

import type {GridColumnOrder} from 'sentry/components/gridEditable';
import queryBasedSortLinkGenerator from 'sentry/components/replays/queryBasedSortLinkGenerator';
import {fromSorts} from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';

interface Props {
  defaultSort: Sort;
  location: Location<{sort?: undefined | string}>;
}

export default function useQueryBasedSorting({location, defaultSort}: Props) {
  const sorts = useMemo(() => fromSorts(location.query.sort), [location.query.sort]);
  const currentSort = useMemo(() => sorts.at(0) ?? defaultSort, [defaultSort, sorts]);

  return {
    makeSortLinkGenerator: (column: GridColumnOrder) =>
      queryBasedSortLinkGenerator(location, column, currentSort),
    currentSort,
  };
}
