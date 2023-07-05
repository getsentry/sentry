import {CSSProperties, memo, MouseEvent, useCallback, useMemo} from 'react';
import classNames from 'classnames';

import BreadcrumbItem from 'sentry/components/replays/breadcrumbs/breadcrumbItem';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {relativeTimeInMs} from 'sentry/components/replays/utils';
import type {Crumb} from 'sentry/types/breadcrumbs';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';

interface Props {
  breadcrumb: Crumb;
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
  breadcrumb,
  expandPaths,
  index,
  onDimensionChange,
  startTimestampMs,
  style,
}: Props) {
  const {currentTime, currentHoverTime} = useReplayContext();

  const {handleMouseEnter, handleMouseLeave, handleClick} =
    useCrumbHandlers(startTimestampMs);

  const onClickTimestamp = useCallback(
    () => handleClick(breadcrumb),
    [handleClick, breadcrumb]
  );
  const onMouseEnter = useCallback(
    () => handleMouseEnter(breadcrumb),
    [handleMouseEnter, breadcrumb]
  );
  const onMouseLeave = useCallback(
    () => handleMouseLeave(breadcrumb),
    [handleMouseLeave, breadcrumb]
  );

  const crumbTime = useMemo(
    () => relativeTimeInMs(new Date(breadcrumb.timestamp || ''), startTimestampMs),
    [breadcrumb.timestamp, startTimestampMs]
  );

  const hasOccurred = currentTime >= crumbTime;
  const isBeforeHover = currentHoverTime === undefined || currentHoverTime >= crumbTime;

  return (
    <BreadcrumbItem
      index={index}
      crumb={breadcrumb}
      className={classNames({
        beforeCurrentTime: hasOccurred,
        afterCurrentTime: !hasOccurred,
        beforeHoverTime: currentHoverTime !== undefined ? isBeforeHover : undefined,
        afterHoverTime: currentHoverTime !== undefined ? !isBeforeHover : undefined,
      })}
      onClick={onClickTimestamp}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      startTimestampMs={startTimestampMs}
      style={style}
      expandPaths={expandPaths}
      onDimensionChange={onDimensionChange}
    />
  );
}

export default memo(BreadcrumbRow);
