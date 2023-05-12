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
  // XXX: this has potential to break the UI, especially with dynamic content
  // in lists (e.g. ObjectInspector). Consider removing this as deps can easily
  // be forgotten to be memoized.
  //
  // The reason for high potential to break UI: updateList clears the cache, so
  // any cells that were expanded but scrolled out of view will have their
  // cached heights reset while they re-render expanded.
  useEffect(() => {
    updateList();
  }, [updateList, deps]);

  return {
    cache,
    updateList,
  };
}

export default useVirtualizedList;
