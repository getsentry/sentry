import type {DependencyList, RefObject} from 'react';
import {useCallback, useEffect, useMemo, useState} from 'react';
import type {CellMeasurerCacheParams, MultiGrid} from 'react-virtualized';
import {CellMeasurerCache} from 'react-virtualized';

type Opts = {
  cellMeasurer: CellMeasurerCacheParams;
  columnCount: number;
  deps: DependencyList;
  dynamicColumnIndex: number;
  gridRef: RefObject<MultiGrid | null>;
};

function useReactVirtualizedGrid({
  cellMeasurer,
  columnCount,
  deps,
  dynamicColumnIndex,
  gridRef,
}: Opts) {
  const cache = useMemo(() => new CellMeasurerCache(cellMeasurer), [cellMeasurer]);
  const [scrollBarWidth, setScrollBarWidth] = useState(0);

  const onWrapperResize = useCallback(() => {
    gridRef.current?.recomputeGridSize({columnIndex: dynamicColumnIndex});
  }, [gridRef, dynamicColumnIndex]);

  useEffect(onWrapperResize, [onWrapperResize, deps]);

  const onScrollbarPresenceChange = useCallback(({vertical, size}: any) => {
    setScrollBarWidth(vertical ? size : 0);
  }, []);

  const getColumnWidth = useCallback(
    (width: number) =>
      ({index}: any) => {
        if (index !== dynamicColumnIndex) {
          return cache.columnWidth({index});
        }

        const columns = Array.from(new Array(columnCount));
        const fullWidth = width - scrollBarWidth;
        const colWidth = columns.reduce(
          (remainingWidth, _, i) =>
            i === dynamicColumnIndex
              ? remainingWidth
              : remainingWidth - cache.columnWidth({index: i}),
          fullWidth
        );
        return Math.max(colWidth, 200);
      },
    [cache, columnCount, dynamicColumnIndex, scrollBarWidth]
  );

  return {
    cache,
    getColumnWidth,
    onScrollbarPresenceChange,
    onWrapperResize,
  };
}

export default useReactVirtualizedGrid;
