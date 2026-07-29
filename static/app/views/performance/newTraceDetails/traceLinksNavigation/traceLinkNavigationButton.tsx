import {LinkButton} from '@sentry/scraps/button';

import {IconChevron} from 'sentry/icons';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {useAdjacentTraceNavigation} from 'sentry/views/performance/newTraceDetails/traceLinksNavigation/useAdjacentTraceNavigation';
import type {ConnectedTraceConnection} from 'sentry/views/performance/newTraceDetails/traceLinksNavigation/useFindLinkedTraces';

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
  const {ariaLabel, tooltip, disabled, onClick, to} = useAdjacentTraceNavigation({
    direction,
    attributes,
    currentTraceStartTimestamp,
  });

  return (
    <LinkButton
      size="xs"
      icon={<IconChevron direction={direction === 'previous' ? 'left' : 'right'} />}
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
