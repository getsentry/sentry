import {DependencyList, RefObject, useEffect, useMemo} from 'react';
import {CellMeasurerCache, CellMeasurerCacheParams, MultiGrid} from 'react-virtualized';

type Opts = {
  cellMeasurer: CellMeasurerCacheParams;
  deps: DependencyList;
  ref: RefObject<MultiGrid>;
  wrapperRef: RefObject<HTMLDivElement>;
};
function useVirtualizedGrid({cellMeasurer, deps, ref, wrapperRef}: Opts) {
  const cache = useMemo(() => new CellMeasurerCache(cellMeasurer), [cellMeasurer]);

  // Clear cache when items changes
  useEffect(() => {
    cache.clearAll();
    ref.current?.recomputeGridSize({columnIndex: 1});
  }, [cache, ref, deps]);

  // Clear cache when wrapper div is resized
  useEffect(() => {
    if (!wrapperRef.current) {
      return () => {};
    }

    const observer = new ResizeObserver(() => {
      ref.current?.recomputeGridSize({columnIndex: 1});
    });
    observer.observe(wrapperRef.current);

    return () => observer.disconnect();
  }, [ref, wrapperRef, deps]);

  return {
    cache,
  };
}

export default useVirtualizedGrid;
