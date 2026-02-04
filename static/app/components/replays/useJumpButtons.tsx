import {useCallback, useMemo, useState} from 'react';

import {getNextReplayFrame} from 'sentry/utils/replays/getReplayEvent';
import type {ReplayFrame} from 'sentry/utils/replays/types';

export interface VisibleRange {
  startIndex: number;
  stopIndex: number;
}

interface Props {
  currentTime: number;
  frames: ReplayFrame[];
  isTable: boolean;
  setScrollToRow: (row: number) => void;
  /**
   * Optional: Pass visible range directly (e.g., from virtualizer) to avoid
   * needing to call onRowsRendered. When provided, internal state is not used.
   */
  visibleRange?: VisibleRange;
}

export default function useJumpButtons({
  currentTime,
  frames,
  isTable,
  setScrollToRow,
  visibleRange: externalVisibleRange,
}: Props) {
  const [internalVisibleRange, setInternalVisibleRange] = useState<VisibleRange>({
    startIndex: 0,
    stopIndex: 0,
  });

  const visibleRange = externalVisibleRange ?? internalVisibleRange;

  const frameIndex = useMemo(() => {
    const frame = getNextReplayFrame({
      frames,
      targetOffsetMs: currentTime,
      allowExact: true,
    });
    if (!frame) {
      return frames.length - 1;
    }
    const index = frames.indexOf(frame);
    // index is -1 at end of replay, so use last index
    return index === -1 ? frames.length - 1 : index;
  }, [currentTime, frames]);

  // Tables have a header row, so we need to adjust for that.
  const rowIndex = isTable ? frameIndex + 1 : frameIndex;

  const handleClick = useCallback(() => {
    // When Jump Down, ensures purple line is visible and index needs to be 1 to jump to top of the list
    const jumpDownFurther =
      isTable && (rowIndex > visibleRange.stopIndex || rowIndex === 0);

    setScrollToRow(rowIndex + (jumpDownFurther ? 1 : 0));
  }, [isTable, rowIndex, setScrollToRow, visibleRange]);

  const onRowsRendered = setInternalVisibleRange;

  const onSectionRendered = useCallback(
    ({rowStartIndex, rowStopIndex}: {rowStartIndex: number; rowStopIndex: number}) => {
      setInternalVisibleRange({startIndex: rowStartIndex, stopIndex: rowStopIndex});
    },
    []
  );

  return {
    handleClick,
    onRowsRendered,
    onSectionRendered,
    showJumpDownButton: rowIndex > visibleRange.stopIndex + 1,
    showJumpUpButton: rowIndex < visibleRange.startIndex,
  };
}
