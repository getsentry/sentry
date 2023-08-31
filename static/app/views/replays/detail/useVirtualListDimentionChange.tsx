import {RefObject, useCallback} from 'react';
import {CellMeasurerCache, List} from 'react-virtualized';

type Opts = {
  cache: CellMeasurerCache;
  listRef: RefObject<List>;
};

export type OnDimensionChange = (index: number) => void;

export default function useVirtualListDimentionChange({cache, listRef}: Opts) {
  const handleDimensionChange = useCallback(
    (index: number) => {
      cache.clear(index, 0);
      listRef.current?.recomputeGridSize({rowIndex: index});
      listRef.current?.forceUpdateGrid();
    },
    [cache, listRef]
  );

  return {
    handleDimensionChange,
  };
}
