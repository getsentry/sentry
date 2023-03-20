import {DependencyList, RefObject, useCallback, useEffect, useMemo} from 'react';
import {CellMeasurerCache, CellMeasurerCacheParams, List} from 'react-virtualized';

type Opts = {
  cellMeasurer: CellMeasurerCacheParams;
  deps: DependencyList;
  ref: RefObject<List>;
};
function useVirtualizedList({cellMeasurer, deps, ref}: Opts) {
  const cache = useMemo(() => new CellMeasurerCache(cellMeasurer), [cellMeasurer]);

  const updateList = useCallback(() => {
    cache.clearAll();
    ref.current?.forceUpdateGrid();
  }, [cache, ref]);

  // Restart cache when items changes
  useEffect(() => {
    updateList();
  }, [updateList, deps]);

  return {
    cache,
    updateList,
  };
}

export default useVirtualizedList;
