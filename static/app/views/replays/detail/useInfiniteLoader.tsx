import {useCallback, useEffect, useRef, useState} from 'react';

export enum LoadingStatus {
  LOADING = 'LOADING',
  LOADED = 'LOADED',
}

type Opts<T> = {
  initialStartIndex: number;
  initialStopIndex: number;
  loadRows: ({startIndex, stopIndex}) => Promise<T>;
};

function useInifiniteLoader<T>({
  initialStartIndex,
  initialStopIndex,
  loadRows,
}: Opts<T[]>) {
  const rowsRef = useRef(new Map<number, T>());
  const rowStateRef = useRef(new Map<number, LoadingStatus>());
  const [rows, setRows] = useState<Record<number, T>>({});
  const [rowState, setRowState] = useState<Record<number, LoadingStatus>>({});

  const isRowLoaded = useCallback(
    ({index}) => rowStateRef.current.get(index) === LoadingStatus.LOADED,
    []
  );

  const loadMoreRows = useCallback(
    async ({startIndex, stopIndex}) => {
      for (let i = startIndex; i < stopIndex; i++) {
        rowStateRef.current.set(i, LoadingStatus.LOADING);
      }

      try {
        const newItems = await loadRows({startIndex, stopIndex});
        for (let i = 0; i < newItems.length; i++) {
          const row = i + startIndex;
          rowsRef.current.set(row, newItems[i]);
          rowStateRef.current.set(row, LoadingStatus.LOADED);
        }

        setRows(Object.fromEntries(rowsRef.current.entries()));
        setRowState(Object.fromEntries(rowStateRef.current.entries()));
      } catch (error) {
        for (let i = startIndex; i <= stopIndex; i++) {
          rowStateRef.current.delete(i);
        }
      }
    },
    [loadRows]
  );

  useEffect(() => {
    loadMoreRows({startIndex: initialStartIndex, stopIndex: initialStopIndex});
  }, [initialStartIndex, initialStopIndex, loadMoreRows]);

  return {
    isRowLoaded,
    loadMoreRows,
    rows,
    rowState,
  };
}

export default useInifiniteLoader;
