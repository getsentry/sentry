import {CSSProperties, MouseEvent, useCallback} from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';

import BreadcrumbItem from 'sentry/components/replays/breadcrumbs/breadcrumbItem';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {Extraction} from 'sentry/utils/replays/extractDomNodes';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import type {ReplayFrame} from 'sentry/utils/replays/types';
import {ReplayTraceRow} from 'sentry/views/replays/detail/perfTable/useReplayPerfData';

interface Props {
  extraction: Extraction | undefined;
  frame: ReplayFrame;
  index: number;
  onClick: ReturnType<typeof useCrumbHandlers>['onClickTimestamp'];
  onDimensionChange: (index: number) => void;
  onInspectorExpanded: (
    index: number,
    path: string,
    expandedState: Record<string, boolean>,
    event: MouseEvent<HTMLDivElement>
  ) => void;
  startTimestampMs: number;
  style: CSSProperties;
  traces: ReplayTraceRow | undefined;
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
  onInspectorExpanded,
  startTimestampMs,
  style,
  traces,
}: Props) {
  const {currentTime, currentHoverTime} = useReplayContext();

  const {onMouseEnter, onMouseLeave} = useCrumbHandlers();
  const handleDimensionChange = useCallback(
    () => onDimensionChange(index),
    [onDimensionChange, index]
  );
  const handleObjectInspectorExpanded = useCallback(
    (path, expandedState, e) =>
      onInspectorExpanded && onInspectorExpanded(index, path, expandedState, e),
    [index, onInspectorExpanded]
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
        frame={frame}
        traces={traces}
        extraction={extraction}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        startTimestampMs={startTimestampMs}
        expandPaths={expandPaths}
        onDimensionChange={handleDimensionChange}
        onInspectorExpanded={handleObjectInspectorExpanded}
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
