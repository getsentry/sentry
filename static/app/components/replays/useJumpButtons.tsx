import {useCallback, useMemo, useState} from 'react';
import {ScrollParams} from 'react-virtualized';

import {getNextReplayFrame} from 'sentry/utils/replays/getReplayEvent';
import {ReplayFrame} from 'sentry/utils/replays/types';

/**
 * The range (`[startIndex, endIndex]`) of table rows that are visible,
 * not including the table header.
 */
type VisibleRange = [number, number];

interface Props {
  currentTime: number;
  frames: ReplayFrame[];
  rowHeight: number;
  setScrollToRow: (row: number) => void;
}

export default function useJumpButtons({
  currentTime,
  frames,
  rowHeight,
  setScrollToRow,
}: Props) {
  const [visibleRange, setVisibleRange] = useState<VisibleRange>([0, 0]);

  const indexOfCurrentRow = useMemo(() => {
    const frame = getNextReplayFrame({
      frames,
      targetOffsetMs: currentTime,
      allowExact: true,
    });
    const frameIndex = frames.findIndex(spanFrame => frame === spanFrame);
    // frameIndex is -1 at end of replay, so use last index
    const index = frameIndex === -1 ? frames.length - 1 : frameIndex;
    return index;
  }, [currentTime, frames]);

  const handleClick = useCallback(() => {
    // When Jump Down, ensures purple line is visible and index needs to be 1 to jump to top of network list
    if (indexOfCurrentRow > visibleRange[1] || indexOfCurrentRow === 0) {
      setScrollToRow(indexOfCurrentRow + 1);
    } else {
      setScrollToRow(indexOfCurrentRow);
    }
  }, [indexOfCurrentRow, setScrollToRow, visibleRange]);

  const handleScroll = useCallback(
    ({clientHeight, scrollTop}: ScrollParams) => {
      setVisibleRange([
        Math.floor(scrollTop / rowHeight),
        Math.floor(scrollTop + clientHeight / rowHeight),
      ]);
    },
    [rowHeight]
  );

  return {
    showJumpUpButton: indexOfCurrentRow < visibleRange[0],
    showJumpDownButton: indexOfCurrentRow > visibleRange[1],
    handleClick,
    handleScroll,
  };
}
