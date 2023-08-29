import {MouseEvent, RefObject, useCallback} from 'react';
import {CellMeasurerCache, List} from 'react-virtualized';

import useVirtualListDimentionChange from 'sentry/views/replays/detail/useVirtualListDimentionChange';

type Opts = {
  cache: CellMeasurerCache;
  expandPathsRef: RefObject<Map<number, Set<string>>>;
  listRef: RefObject<List>;
};

export type OnDimensionChange = (
  index: number,
  path: string,
  expandedState: Record<string, boolean>,
  event: MouseEvent<HTMLDivElement>
) => void;

export default function useVirtualizedInspector({cache, listRef, expandPathsRef}: Opts) {
  const {handleDimensionChange} = useVirtualListDimentionChange({cache, listRef});

  return {
    expandPaths: expandPathsRef.current,
    handleDimensionChange: useCallback(
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
        handleDimensionChange(index);
        event.stopPropagation();
      },
      [expandPathsRef, handleDimensionChange]
    ),
  };
}
