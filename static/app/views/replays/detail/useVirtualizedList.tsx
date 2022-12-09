import {DependencyList, RefObject, useEffect, useMemo} from 'react';
import {CellMeasurerCache, List as ReactVirtualizedList} from 'react-virtualized';

type Opts = {
  deps: DependencyList;
  listRef: RefObject<ReactVirtualizedList>;
};
function useVirtualizedList({deps, listRef}: Opts) {
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
  }, [cache, listRef, deps]);

  return {
    cache,
  };
}

export default useVirtualizedList;
