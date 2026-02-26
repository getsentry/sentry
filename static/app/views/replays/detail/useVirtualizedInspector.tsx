import type {RefObject} from 'react';
import {useCallback} from 'react';

type Opts = {
  expandPathsRef: RefObject<Map<number, Set<string>>>;
  onMeasure: (index: number) => void;
};

export type OnExpandCallback = (
  path: string,
  expandedState: Record<string, boolean>
) => void;

export default function useVirtualizedInspector({expandPathsRef, onMeasure}: Opts) {
  return {
    expandPaths: expandPathsRef.current,
    handleDimensionChange: useCallback(
      (index: number, path: string, expandedState: Record<string, boolean>) => {
        const rowState = expandPathsRef.current?.get(index) || new Set<string>();
        if (expandedState[path]) {
          rowState.add(path);
        } else {
          // Collapsed, i.e. its default state, so no need to store state
          rowState.delete(path);
        }
        expandPathsRef.current?.set(index, rowState);
        onMeasure(index);
      },
      [expandPathsRef, onMeasure]
    ),
  };
}
