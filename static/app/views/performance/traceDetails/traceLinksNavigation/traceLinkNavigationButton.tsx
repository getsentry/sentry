import {LinkButton} from '@sentry/scraps/button';

import type {
  TraceItemResponseAttribute,
  TraceItemResponseLink,
} from 'sentry/views/explore/hooks/useTraceItemDetails';
import type {ConnectedTraceConnection} from 'sentry/views/performance/traceDetails/traceLinksNavigation/types';
import {useAdjacentTraceNavigation} from 'sentry/views/performance/traceDetails/traceLinksNavigation/useAdjacentTraceNavigation';

type TraceLinkNavigationButtonProps = {
  attributes: TraceItemResponseAttribute[];
  currentTraceStartTimestamp: number;
  direction: ConnectedTraceConnection;
  links?: TraceItemResponseLink[];
};

export function TraceLinkNavigationButton({
  direction,
  attributes,
  links,
  currentTraceStartTimestamp,
}: TraceLinkNavigationButtonProps) {
  const {ariaLabel, icon, tooltip, disabled, onClick, to} = useAdjacentTraceNavigation({
    direction,
    attributes,
    links,
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
        title: tooltip,
      }}
      onClick={onClick}
      disabled={disabled}
      to={to}
    />
  );
}
