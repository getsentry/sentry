import {CSSProperties, memo, useCallback} from 'react';

import BreadcrumbItem from 'sentry/components/replays/breadcrumbs/breadcrumbItem';
import type {Crumb} from 'sentry/types/breadcrumbs';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';

interface Props {
  breadcrumb: Crumb;
  isCurrent: boolean;
  isHovered: boolean;
  startTimestampMs: number;
  style: CSSProperties;
  breadcrumbIndex?: number[][];
}

function BreadcrumbRow({
  breadcrumb,
  startTimestampMs,
  style,
  isCurrent,
  isHovered,
}: Props) {
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
