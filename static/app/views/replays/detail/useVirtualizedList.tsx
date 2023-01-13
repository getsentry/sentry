import type {DependencyList, RefObject} from 'react';
import {useEffect, useMemo} from 'react';
import type {CellMeasurerCacheParams, List} from 'react-virtualized';
import {CellMeasurerCache} from 'react-virtualized';

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
