import {
  ComponentProps,
  RefObject,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import type VirtualGrid from 'sentry/views/replays/detail/virtualGrid';

type CellRenderer<T> = ComponentProps<typeof VirtualGrid<T>>['cellRenderer'];
type CellRendererProps<T> = ComponentProps<CellRenderer<T>>;
type Size = 'auto' | number | `min:${number}px` | `max:${number}px`;

type Opts = {
  rowHeight: Size;
  widths: Size[];
};

function getHeightMeasurer(height: Size) {
  if (typeof height === 'number') {
    return () => height;
  }
  return (ref: RefObject<HTMLDivElement>) => ref.current?.offsetHeight;
}

function getWidthMeasurer(width: Size) {
  if (typeof width === 'number') {
    return () => width;
  }
  return (ref: RefObject<HTMLDivElement>) => ref.current?.offsetWidth;
}

function useVirtualGridMeasurements({rowHeight, widths}: Opts) {
  // Max height of each row in the table
  // const maxHeightsRef = useRef(new Map());
  const [maxHeights, setMaxHeights] = useState({});

  // Max width of each column in the table
  // const maxWidthsRef = useRef(new Map());
  const [maxWidths, setMaxWidths] = useState({});

  // Log to remember if we measured a cell or not already
  const measurementlog = useRef(new Map());

  const heightMeasurer = getHeightMeasurer(rowHeight);
  const widthMeasurers = widths.map(getWidthMeasurer);

  const updateMaxIfChanged = (
    map: Record<number, number>,
    value: number,
    index: number,
    setter: typeof setMaxHeights
  ) => {
    const prevMaxHeight = map[index] || 0;
    if (Math.max(value, prevMaxHeight) !== prevMaxHeight) {
      setter(prev => ({...prev, [index]: value}));
    }
  };

  function cellMeasurer<T>(Component: CellRenderer<T>) {
    function CellMeasurer(props: CellRendererProps<T>) {
      const {rowIndex, columnIndex, style} = props;

      const div = useRef<HTMLDivElement>(null);

      useLayoutEffect(() => {
        const key = [rowIndex, columnIndex];
        if (!div.current || measurementlog.current.has(key)) {
          return;
        }
        const height = heightMeasurer(div) || 0;
        const width = widthMeasurers[columnIndex](div) || 0;

        updateMaxIfChanged(maxHeights, height, rowIndex, setMaxHeights);
        updateMaxIfChanged(maxWidths, width, columnIndex, setMaxWidths);

        // const prevMaxHeight = maxHeightsRef.current.get(rowIndex) || 0;
        // if (Math.max(height, prevMaxHeight) !== prevMaxHeight) {
        //   maxHeightsRef.current.set(rowIndex, height);
        // }

        // const prevMaxWidth = maxWidthsRef.current.get(columnIndex) || 0;
        // if (Math.max(width, prevMaxWidth) !== prevMaxWidth) {
        //   maxWidthsRef.current.set(columnIndex, width);
        // }

        measurementlog.current.set(key, true);
      }, [rowIndex, columnIndex]);

      // const key = [rowIndex, columnIndex];

      // if (measurementlog.current.has(key)) {
      return (
        <Component
          {...props}
          style={{
            ...style,
            height: maxHeights[rowIndex],
            width: maxWidths[columnIndex],
          }}
        />
      );
      // }

      // return (
      //   <div>
      //     <Component {...props} style={{}} />
      //   </div>
      // );
    }
    return CellMeasurer;
  }

  return {
    maxHeights,
    maxWidths,
    cellMeasurer,
    columnWidth: useCallback(index => maxHeights[index] || 0, [maxHeights]),
    onResize: () => {},
    rowHeight: useCallback(index => maxWidths[index] || 0, [maxWidths]),
  };
}

export default useVirtualGridMeasurements;
