import {CSSProperties, MouseEvent} from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';

import BreadcrumbItem from 'sentry/components/replays/breadcrumbs/breadcrumbItem';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {Extraction} from 'sentry/utils/replays/extractDomNodes';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import type {ReplayFrame} from 'sentry/utils/replays/types';

interface Props {
  extraction: Extraction | undefined;
  frame: ReplayFrame;
  index: number;
  onClick: ReturnType<typeof useCrumbHandlers>['onClickTimestamp'];
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
  expandPaths,
  frame,
  extraction,
  index,
  onClick,
  onDimensionChange,
  startTimestampMs,
  style,
}: Props) {
  const {currentTime, currentHoverTime} = useReplayContext();

  const {onMouseEnter, onMouseLeave} = useCrumbHandlers();

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
        extraction={extraction}
        onClick={onClick}
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
