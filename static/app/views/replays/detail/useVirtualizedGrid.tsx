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
   * */
  columnCount: number;
  /**
   * List of other values that should trigger re-computing column sizes
   * */
  deps: DependencyList;
  /**
   * There must be one column with a dynamic width, so the table can fill all available width inside the container
   */
  dyanmicColumnIndex: number;
  /**
   * The <MultiGrid> elem.
   */
  gridRef: RefObject<MultiGrid>;
  /**
   * The container of the grid.
   * When this is resized resizes we will recompute the width of the column that has a dyanmic width.
   */
  // wrapperRef: RefObject<HTMLDivElement>;
};

function useVirtualizedGrid({
  cellMeasurer,
  columnCount,
  deps,
  dyanmicColumnIndex,
  gridRef,
}: // wrapperRef,
Opts) {
  const cache = useMemo(() => new CellMeasurerCache(cellMeasurer), [cellMeasurer]);
  const [scrollBarWidth, setScrollBarWidth] = useState(0);

  // Recompute the width of the dynamic column when deps change (ie: a search/filter is applied)
  useEffect(() => {
    cache.clearAll();
    gridRef.current?.recomputeGridSize({columnIndex: dyanmicColumnIndex});
  }, [cache, gridRef, dyanmicColumnIndex, deps]);

  const onWrapperResize = useCallback(() => {
    // TODO: debounce?
    gridRef.current?.recomputeGridSize({columnIndex: dyanmicColumnIndex});
  }, [gridRef, dyanmicColumnIndex]);

  const onScrollbarPresenceChange = useCallback(({vertical, size}) => {
    setScrollBarWidth(vertical ? size : 0);
  }, []);

  const getColumnWidth = useCallback(
    (width: number) =>
      ({index}) => {
        if (index === dyanmicColumnIndex) {
          const colWidth = Math.max(
            Array.from(new Array(columnCount)).reduce(
              (remaining, _, i) =>
                i === dyanmicColumnIndex
                  ? remaining
                  : remaining - cache.columnWidth({index: i}),
              width - scrollBarWidth
            ),
            200
          );
          return colWidth;
        }

        return cache.columnWidth({index});
      },
    [cache, columnCount, dyanmicColumnIndex, scrollBarWidth]
  );

  return {
    cache,
    getColumnWidth,
    onScrollbarPresenceChange,
    onWrapperResize,
  };
}

export default useVirtualizedGrid;
