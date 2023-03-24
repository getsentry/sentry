import {CSSProperties, memo, useCallback, useMemo} from 'react';

import BreadcrumbItem from 'sentry/components/replays/breadcrumbs/breadcrumbItem';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import type {Crumb} from 'sentry/types/breadcrumbs';
import {getPrevReplayEvent} from 'sentry/utils/replays/getReplayEvent';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';

interface Props {
  breadcrumb: Crumb;
  breadcrumbs: Crumb[];
  startTimestampMs: number;
  style: CSSProperties;
}

function BreadcrumbRow({breadcrumb, breadcrumbs, startTimestampMs, style}: Props) {
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

  const current = useMemo(
    () =>
      getPrevReplayEvent({
        items: breadcrumbs,
        targetTimestampMs: startTimestampMs + currentTime,
        allowEqual: true,
        allowExact: true,
      }),
    [breadcrumbs, currentTime, startTimestampMs]
  );

  const hovered = useMemo(
    () =>
      currentHoverTime
        ? getPrevReplayEvent({
            items: breadcrumbs,
            targetTimestampMs: startTimestampMs + currentHoverTime,
            allowEqual: true,
            allowExact: true,
          })
        : undefined,
    [breadcrumbs, currentHoverTime, startTimestampMs]
  );

  const isCurrent = breadcrumb.id === current?.id;
  const isHovered = breadcrumb.id === hovered?.id;

  return (
    <BreadcrumbItem
      crumb={breadcrumb}
      isCurrent={isCurrent}
      isHovered={isHovered}
      onClick={onClickTimestamp}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      startTimestampMs={startTimestampMs}
      style={style}
    />
  );
}

export default memo(BreadcrumbRow);
