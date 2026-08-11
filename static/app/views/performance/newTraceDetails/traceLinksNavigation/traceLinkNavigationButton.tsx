import {LinkButton} from '@sentry/scraps/button';

import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import type {ConnectedTraceConnection} from 'sentry/views/performance/newTraceDetails/traceLinksNavigation/types';
import {useAdjacentTraceNavigation} from 'sentry/views/performance/newTraceDetails/traceLinksNavigation/useAdjacentTraceNavigation';

type TraceLinkNavigationButtonProps = {
  attributes: TraceItemResponseAttribute[];
  currentTraceStartTimestamp: number;
  direction: ConnectedTraceConnection;
};

export function TraceLinkNavigationButton({
  direction,
  attributes,
  currentTraceStartTimestamp,
}: TraceLinkNavigationButtonProps) {
  const {ariaLabel, icon, tooltip, disabled, onClick, to} = useAdjacentTraceNavigation({
    direction,
    attributes,
    currentTraceStartTimestamp,
  });

  return (
    <LinkButton
      size="xs"
      icon={icon}
      aria-label={ariaLabel}
      tooltipProps={{
        position: 'top',
        delay: 400,
        isHoverable: true,
        title: tooltip,
      }}
      onClick={onClick}
      disabled={disabled}
      to={to}
    />
  );
}
