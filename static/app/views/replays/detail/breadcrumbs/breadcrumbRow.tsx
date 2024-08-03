import type {CSSProperties, MouseEvent} from 'react';
import {useCallback, useState} from 'react';
import classNames from 'classnames';

import BreadcrumbItem from 'sentry/components/replays/breadcrumbs/breadcrumbItem';
import type {Extraction} from 'sentry/utils/replays/extractHtml';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import useReplayCurrentTime from 'sentry/utils/replays/playback/hooks/useReplayCurrentTime';
import useCurrentHoverTime from 'sentry/utils/replays/playback/providers/useCurrentHoverTime';
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
  const [currentTime, handleCurrentTime] = useState(0);
  useReplayCurrentTime({callback: handleCurrentTime});
  const [currentHoverTime] = useCurrentHoverTime();

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
