import type {CSSProperties} from 'react';
import {useCallback} from 'react';
import classNames from 'classnames';

import BreadcrumbItem from 'sentry/components/replays/breadcrumbs/breadcrumbItem';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import useCurrentHoverTime from 'sentry/utils/replays/playback/providers/useCurrentHoverTime';
import type {ReplayFrame} from 'sentry/utils/replays/types';

interface Props {
  allowShowSnippet: boolean;
  frame: ReplayFrame;
  index: number;
  onClick: ReturnType<typeof useCrumbHandlers>['onClickTimestamp'];
  onInspectorExpanded: (
    index: number,
    path: string,
    expandedState: Record<string, boolean>
  ) => void;
  onShowSnippet: (index: number) => void;
  showSnippet: boolean;
  startTimestampMs: number;
  style: CSSProperties;
  breadcrumbIndex?: number[][];
  className?: string;
  expandPaths?: string[];
  ref?: React.Ref<HTMLDivElement>;
  updateDimensions?: () => void;
}

function BreadcrumbRow({
  className,
  expandPaths,
  frame,
  index,
  onClick,
  onInspectorExpanded,
  showSnippet,
  startTimestampMs,
  style,
  ref,
  onShowSnippet,
  updateDimensions,
  allowShowSnippet,
}: Props) {
  const {currentTime} = useReplayContext();
  const [currentHoverTime] = useCurrentHoverTime();

  const {onMouseEnter, onMouseLeave} = useCrumbHandlers();

  const handleObjectInspectorExpanded = useCallback(
    (path: any, expandedState: any) => onInspectorExpanded?.(index, path, expandedState),
    [index, onInspectorExpanded]
  );

  const handleShowSnippet = useCallback(() => {
    onShowSnippet(index);
  }, [index, onShowSnippet]);

  const hasOccurred = currentTime >= frame.offsetMs;
  const isBeforeHover =
    currentHoverTime === undefined || currentHoverTime >= frame.offsetMs;

  return (
    <BreadcrumbItem
      ref={ref}
      className={classNames(className, {
        beforeCurrentTime: hasOccurred,
        afterCurrentTime: !hasOccurred,
        beforeHoverTime: currentHoverTime === undefined ? undefined : isBeforeHover,
        afterHoverTime: currentHoverTime === undefined ? undefined : !isBeforeHover,
      })}
      style={style}
      frame={frame}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      startTimestampMs={startTimestampMs}
      expandPaths={expandPaths}
      onInspectorExpanded={handleObjectInspectorExpanded}
      showSnippet={showSnippet}
      allowShowSnippet={allowShowSnippet}
      updateDimensions={updateDimensions}
      onShowSnippet={handleShowSnippet}
    />
  );
}

export default BreadcrumbRow;
