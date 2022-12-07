import {useCallback, useMemo, useState} from 'react';

import {ISortConfig, sortNetwork} from 'sentry/views/replays/detail/network/utils';
import type {NetworkSpan} from 'sentry/views/replays/types';

type Opts = {items: NetworkSpan[]};

function useSortNetwork({items}: Opts) {
  const [sortConfig, setSortConfig] = useState<ISortConfig>({
    by: 'startTimestamp',
    asc: true,
    getValue: row => row[sortConfig.by],
  });

  const sortedItems = useMemo(() => sortNetwork(items, sortConfig), [items, sortConfig]);

  const handleSort = useCallback(
    (
      fieldName: string | keyof NetworkSpan,
      getValue: (row: NetworkSpan) => any = (row: NetworkSpan) => row[fieldName]
    ) => {
      setSortConfig(prevSort =>
        prevSort.by === fieldName
          ? {by: fieldName, asc: !prevSort.asc, getValue}
          : {by: fieldName, asc: true, getValue}
      );
    },
    [setSortConfig]
  );

  return {
    handleSort,
    items: sortedItems,
    sortConfig,
  };
}

export default useSortNetwork;
