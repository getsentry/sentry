import {MouseEvent, RefObject, useCallback} from 'react';
import {CellMeasurerCache, List} from 'react-virtualized';

import {OnExpand} from 'sentry/components/objectInspector';

type Opts = {
  cache: CellMeasurerCache;
  expandPathsRef: RefObject<Map<number, Set<string>>>;
  listRef: RefObject<List>;
};
function useVirtualizedInspector({cache, listRef, expandPathsRef}: Opts) {
  const handleDimensionChange = useCallback(
    (
      index: number,
      path: string,
      expandedState: Record<string, boolean>,
      event: MouseEvent<HTMLDivElement>
    ) => {
      const rowState = expandPathsRef.current?.get(index) || new Set();
      if (expandedState[path]) {
        rowState.add(path);
      } else {
        // Collapsed, i.e. its default state, so no need to store state
        rowState.delete(path);
      }
      expandPathsRef.current?.set(index, rowState);
      cache.clear(index, 0);
      listRef.current?.recomputeGridSize({rowIndex: index});
      listRef.current?.forceUpdateGrid();
      event.stopPropagation();
    },
    [cache, expandPathsRef, listRef]
  );

  return {
    expandPaths: expandPathsRef.current,
    handleDimensionChange,
  };
}

export type OnDimensionChange = OnExpand extends (...a: infer U) => infer R
  ? (index: number, ...a: U) => R
  : never;
export default useVirtualizedInspector;
