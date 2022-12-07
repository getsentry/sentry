import {DependencyList, RefObject, useEffect, useMemo} from 'react';
import {CellMeasurerCache, CellMeasurerCacheParams, MultiGrid} from 'react-virtualized';

type Opts = {
  cellMeasurer: CellMeasurerCacheParams;
  deps: DependencyList;
  ref: RefObject<MultiGrid>;
};
function useVirtualizedList({cellMeasurer, deps, ref}: Opts) {
  const cache = useMemo(() => new CellMeasurerCache(cellMeasurer), [cellMeasurer]);

  // Restart cache when items changes
  useEffect(() => {
    cache.clearAll();
    ref.current?.recomputeGridSize({columnIndex: 1});
  }, [cache, ref, deps]);

  return {
    cache,
  };
}

export default useVirtualizedList;
