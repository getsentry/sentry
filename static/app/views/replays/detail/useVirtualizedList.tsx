import {RefObject, useEffect, useMemo} from 'react';
import {CellMeasurerCache, List as ReactVirtualizedList} from 'react-virtualized';

type Opts = {
  items: unknown[];
  listRef: RefObject<ReactVirtualizedList>;
};
function useVirtualizedList({listRef, items}: Opts) {
  const cache = useMemo(
    () =>
      new CellMeasurerCache({
        fixedWidth: true,
        minHeight: 24,
      }),
    []
  );

  // Restart cache when items changes
  useEffect(() => {
    cache.clearAll();
    listRef.current?.forceUpdateGrid();
  }, [cache, items, listRef]);

  return {
    cache,
  };
}

export default useVirtualizedList;
