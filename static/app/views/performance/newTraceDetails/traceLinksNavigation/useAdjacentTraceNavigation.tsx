import {useMemo} from 'react';

import {ExternalLink} from '@sentry/scraps/link';
import type {LinkProps} from '@sentry/scraps/link';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {IconChevron} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import type {ConnectedTraceConnection} from 'sentry/views/performance/newTraceDetails/traceLinksNavigation/types';
import {useFindAdjacentTrace} from 'sentry/views/performance/newTraceDetails/traceLinksNavigation/useFindLinkedTraces';
import {useTraceStateDispatch} from 'sentry/views/performance/newTraceDetails/traceState/traceStateProvider';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';

const LINKED_TRACE_MAX_DURATION = 3600; // 1h in seconds

interface UseAdjacentTraceNavigationProps {
  attributes: TraceItemResponseAttribute[];
  currentTraceStartTimestamp: number;
  direction: ConnectedTraceConnection;
}

export interface AdjacentTraceNavigation {
  ariaLabel: string;
  disabled: boolean;
  icon: React.ReactNode;
  onClick: () => void;
  to: LinkProps['to'];
  tooltip: React.ReactNode;
}

/**
 * Resolves the link to the previous/next trace of the same session, along with
 * the labels and disabled state shared by every entry point that renders it.
 */
export function useAdjacentTraceNavigation({
  direction,
  attributes,
  currentTraceStartTimestamp,
}: UseAdjacentTraceNavigationProps): AdjacentTraceNavigation {
  const organization = useOrganization();
  const location = useLocation();
  const traceDispatch = useTraceStateDispatch();

  // We connect traces over a 1h period - As we don't have timestamps of the linked trace, it is calculated based on this timeframe
  const linkedTraceWindowTimestamp =
    direction === 'previous'
      ? currentTraceStartTimestamp - LINKED_TRACE_MAX_DURATION // Earliest start time of previous trace (- 1h)
      : currentTraceStartTimestamp + LINKED_TRACE_MAX_DURATION; // Latest end time of next trace (+ 1h)

  const {
    adjacentTraceEndTimestamp,
    adjacentTraceStartTimestamp,
    icon,
    ariaLabel,
    tooltip,
  } = useMemo(() => {
    if (direction === 'previous') {
      return {
        adjacentTraceEndTimestamp: currentTraceStartTimestamp,
        adjacentTraceStartTimestamp: linkedTraceWindowTimestamp,
        icon: <IconChevron direction="left" />,
        ariaLabel: t('Previous Trace'),
        tooltip: tct('Go to the previous trace of the same session. [link:Learn More]', {
          link: (
            <ExternalLink href="https://docs.sentry.io/concepts/key-terms/tracing/trace-view/#previous-and-next-traces" />
          ),
        }),
      };
    }
    return {
      adjacentTraceEndTimestamp: linkedTraceWindowTimestamp,
      adjacentTraceStartTimestamp: currentTraceStartTimestamp,
      icon: <IconChevron direction="right" />,
      ariaLabel: t('Next Trace'),
      tooltip: tct('Go to the next trace of the same session. [link:Learn More]', {
        link: (
          <ExternalLink href="https://docs.sentry.io/concepts/key-terms/tracing/trace-view/#previous-and-next-traces" />
        ),
      }),
    };
  }, [direction, currentTraceStartTimestamp, linkedTraceWindowTimestamp]);

  const {
    available: isTraceAvailable,
    id: traceSpanId,
    trace: traceId,
  } = useFindAdjacentTrace({
    direction,
    adjacentTraceEndTimestamp,
    adjacentTraceStartTimestamp,
    attributes,
  });

  const dateSelection = useMemo(
    () => normalizeDateTimeParams(location.query),
    [location.query]
  );

  return {
    ariaLabel,
    icon,
    tooltip,
    disabled: !traceId || !isTraceAvailable,
    onClick: () => traceDispatch({type: 'minimize drawer', payload: true}),
    to: getTraceDetailsUrl({
      traceSlug: traceId ?? '',
      spanId: traceSpanId,
      dateSelection,
      timestamp: linkedTraceWindowTimestamp,
      location,
      organization,
    }),
  };
}
