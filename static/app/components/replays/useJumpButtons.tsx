import {useCallback, useMemo, useState} from 'react';
import type {IndexRange, SectionRenderedParams} from 'react-virtualized';

import {getNextReplayFrame} from 'sentry/utils/replays/getReplayEvent';
import type {ReplayFrame} from 'sentry/utils/replays/types';

interface Props {
  currentTime: number;
  frames: ReplayFrame[];
  isTable: boolean;
  setScrollToRow: (row: number) => void;
}

export default function useJumpButtons({
  currentTime,
  frames,
  isTable,
  setScrollToRow,
}: Props) {
  const [visibleRange, setVisibleRange] = useState<IndexRange>({
    startIndex: 0,
    stopIndex: 0,
  });

  const frameIndex = useMemo(() => {
    const frame = getNextReplayFrame({
      frames,
      targetOffsetMs: currentTime,
      allowExact: true,
    });
    const index = frames.findIndex(spanFrame => frame === spanFrame);
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

  const onRowsRendered = setVisibleRange;

  const onSectionRendered = useCallback(
    ({rowStartIndex, rowStopIndex}: SectionRenderedParams) => {
      setVisibleRange({startIndex: rowStartIndex, stopIndex: rowStopIndex});
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
