import type {CSSProperties, MouseEvent} from 'react';
import {useCallback} from 'react';
import classNames from 'classnames';

import BreadcrumbItem from 'sentry/components/replays/breadcrumbs/breadcrumbItem';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import type {Extraction} from 'sentry/utils/replays/extractDomNodes';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import type {ReplayFrame} from 'sentry/utils/replays/types';

interface Props {
  extraction: Extraction | undefined;
  frame: ReplayFrame;
  index: number;
  onClick: ReturnType<typeof useCrumbHandlers>['onClickTimestamp'];
  onInspectorExpanded: (
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

export default function BreadcrumbRow({
  expandPaths,
  extraction,
  frame,
  index,
  onClick,
  onInspectorExpanded,
  startTimestampMs,
  style,
}: Props) {
  const {currentTime, currentHoverTime} = useReplayContext();

  const {onMouseEnter, onMouseLeave} = useCrumbHandlers();

  const handleObjectInspectorExpanded = useCallback(
    (path, expandedState, e) => onInspectorExpanded?.(index, path, expandedState, e),
    [index, onInspectorExpanded]
  );

  const hasOccurred = currentTime >= frame.offsetMs;
  const isBeforeHover =
    currentHoverTime === undefined || currentHoverTime >= frame.offsetMs;

  return (
    <BreadcrumbItem
      className={classNames({
        beforeCurrentTime: hasOccurred,
        afterCurrentTime: !hasOccurred,
        beforeHoverTime: currentHoverTime !== undefined ? isBeforeHover : undefined,
        afterHoverTime: currentHoverTime !== undefined ? !isBeforeHover : undefined,
      })}
      style={style}
      frame={frame}
      extraction={extraction}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      startTimestampMs={startTimestampMs}
      expandPaths={expandPaths}
      onInspectorExpanded={handleObjectInspectorExpanded}
    />
  );
}
