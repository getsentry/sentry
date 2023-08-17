import {MouseEvent, RefObject, useCallback} from 'react';
import {CellMeasurerCache, List} from 'react-virtualized';

import {OnExpandCallback} from 'sentry/components/objectInspector';

type Opts = {
  cache: CellMeasurerCache;
  listRef: RefObject<List>;
};

export type OnDimensionChange = OnExpandCallback extends (...a: infer U) => infer R
  ? (index: number, ...a: U) => R
  : never;

export default function useVirtualListDimentionChange({cache, listRef}: Opts) {
  const handleDimensionChange = useCallback(
    (index: number, event: MouseEvent<HTMLDivElement>) => {
      cache.clear(index, 0);
      listRef.current?.recomputeGridSize({rowIndex: index});
      listRef.current?.forceUpdateGrid();
      event.stopPropagation();
    },
    [cache, listRef]
  );

  return {
    handleDimensionChange,
  };
}
