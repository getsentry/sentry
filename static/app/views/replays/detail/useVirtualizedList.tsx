import {type DependencyList, type RefObject, useEffect, useMemo} from 'react';
import {
  type CellMeasurerCacheParams,
  type List,
  CellMeasurerCache,
} from 'react-virtualized';

type Opts = {
  cellMeasurer: CellMeasurerCacheParams;
  deps: DependencyList;
  ref: RefObject<List>;
};
function useVirtualizedList({cellMeasurer, deps, ref}: Opts) {
  const cache = useMemo(() => new CellMeasurerCache(cellMeasurer), [cellMeasurer]);

  // Restart cache when items changes
  useEffect(() => {
    cache.clearAll();
    ref.current?.forceUpdateGrid();
  }, [cache, ref, deps]);

  return {
    cache,
  };
}

export default useVirtualizedList;
