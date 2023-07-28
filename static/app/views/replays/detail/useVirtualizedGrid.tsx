import {
  DependencyList,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {CellMeasurerCache, CellMeasurerCacheParams, MultiGrid} from 'react-virtualized';

type Opts = {
  /**
   * Options for the CellMeasurerCache constructor
   */
  cellMeasurer: CellMeasurerCacheParams;
  /**
   * How many columns are being rendered
   */
  columnCount: number;
  /**
   * List of other values that should trigger re-computing column sizes
   */
  deps: DependencyList;
  /**
   * There must be one column with a dynamic width, so the table can fill all available width inside the container
   */
  dynamicColumnIndex: number;
  /**
   * The <MultiGrid> elem.
   */
  gridRef: RefObject<MultiGrid>;
};

const globalCellMeasurerCache = new WeakMap<CellMeasurerCacheParams, CellMeasurerCache>();

function useVirtualizedGrid({
  cellMeasurer,
  columnCount,
  deps,
  dynamicColumnIndex,
  gridRef,
}: Opts) {
  const cache = useMemo(() => {
    if (globalCellMeasurerCache.has(cellMeasurer)) {
      return globalCellMeasurerCache.get(cellMeasurer)!;
    }
    const newCellMeasurer = new CellMeasurerCache(cellMeasurer);
    globalCellMeasurerCache.set(cellMeasurer, newCellMeasurer);
    return newCellMeasurer;
  }, [cellMeasurer]);
  const [scrollBarWidth, setScrollBarWidth] = useState(0);

  const onWrapperResize = useCallback(() => {
    // TODO: debounce?
    gridRef.current?.recomputeGridSize({columnIndex: dynamicColumnIndex});
  }, [gridRef, dynamicColumnIndex]);

  // Recompute the width of the dynamic column when deps change (ie: a search/filter is applied)
  useEffect(onWrapperResize, [onWrapperResize, deps]);

  const onScrollbarPresenceChange = useCallback(({vertical, size}) => {
    setScrollBarWidth(vertical ? size : 0);
  }, []);

  const getColumnWidth = useCallback(
    (width: number) =>
      ({index}) => {
        if (index !== dynamicColumnIndex) {
          return cache.columnWidth({index});
        }

        const columns = Array.from(new Array(columnCount));
        const fullWidth = width - scrollBarWidth;
        // Take the full width available, and remove all the static/cached widths
        // so we know how much space is available for our dynamic column.
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

export default useVirtualizedGrid;
