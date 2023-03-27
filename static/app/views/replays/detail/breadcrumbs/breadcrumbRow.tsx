import {CSSProperties, memo, MouseEvent, useCallback} from 'react';

import BreadcrumbItem from 'sentry/components/replays/breadcrumbs/breadcrumbItem';
import type {Crumb} from 'sentry/types/breadcrumbs';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';

interface Props {
  breadcrumb: Crumb;
  index: number;
  isCurrent: boolean;
  isHovered: boolean;
  startTimestampMs: number;
  style: CSSProperties;
  breadcrumbIndex?: number[][];
  expandPaths?: string[];
  onDimensionChange?: (
    index: number,
    path: string,
    expandedState: Record<string, boolean>,
    event: MouseEvent<HTMLDivElement>
  ) => void;
}

function BreadcrumbRow({
  breadcrumb,
  expandPaths,
  index,
  isCurrent,
  onDimensionChange,
  isHovered,
  startTimestampMs,
  style,
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
      index={index}
      crumb={breadcrumb}
      isCurrent={isCurrent}
      isHovered={isHovered}
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
