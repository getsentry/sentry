import {CSSProperties, MouseEvent, useCallback} from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';

import BreadcrumbItem from 'sentry/components/replays/breadcrumbs/breadcrumbItem';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import type {ReplayFrame} from 'sentry/utils/replays/types';

interface Props {
  frame: ReplayFrame;
  index: number;
  onDimensionChange: (
    index: number,
    path: string,
    expandedState: Record<string, boolean>,
    event: MouseEvent<HTMLDivElement>
  ) => void;
  startTimestampMs: number;
  style: CSSProperties;
  breadcrumbIndex?: number[][];
  expandPaths?: string[];
}

function BreadcrumbRow({
  frame,
  expandPaths,
  index,
  onDimensionChange,
  startTimestampMs,
  style,
}: Props) {
  const {currentTime, currentHoverTime} = useReplayContext();

  const {handleMouseEnter, handleMouseLeave, handleClick} =
    useCrumbHandlers(startTimestampMs);

  const onClickTimestamp = useCallback(() => handleClick(frame), [handleClick, frame]);
  const onMouseEnter = useCallback(
    () => handleMouseEnter(frame),
    [handleMouseEnter, frame]
  );
  const onMouseLeave = useCallback(
    () => handleMouseLeave(frame),
    [handleMouseLeave, frame]
  );

  const hasOccurred = currentTime >= frame.offsetMs;
  const isBeforeHover =
    currentHoverTime === undefined || currentHoverTime >= frame.offsetMs;

  return (
    <StyledTimeBorder
      className={classNames({
        beforeCurrentTime: hasOccurred,
        afterCurrentTime: !hasOccurred,
        beforeHoverTime: currentHoverTime !== undefined ? isBeforeHover : undefined,
        afterHoverTime: currentHoverTime !== undefined ? !isBeforeHover : undefined,
      })}
      style={style}
    >
      <BreadcrumbItem
        index={index}
        frame={frame}
        onClick={onClickTimestamp}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        startTimestampMs={startTimestampMs}
        expandPaths={expandPaths}
        onDimensionChange={onDimensionChange}
      />
    </StyledTimeBorder>
  );
}

const StyledTimeBorder = styled('div')`
  /* Overridden in TabItemContainer, depending on *CurrentTime and *HoverTime classes */
  border-top: 1px solid transparent;
  border-bottom: 1px solid transparent;
`;

export default BreadcrumbRow;
