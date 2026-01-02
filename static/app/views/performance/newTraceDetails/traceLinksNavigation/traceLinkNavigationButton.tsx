import {useMemo} from 'react';

import {LinkButton} from '@sentry/scraps/button/linkButton';
import {ExternalLink} from '@sentry/scraps/link';

import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {IconChevron} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {useFindAdjacentTrace} from 'sentry/views/performance/newTraceDetails/traceLinksNavigation/useFindLinkedTraces';
import {useTraceStateDispatch} from 'sentry/views/performance/newTraceDetails/traceState/traceStateProvider';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';

export type ConnectedTraceConnection = 'previous' | 'next';

const LINKED_TRACE_MAX_DURATION = 3600; // 1h in seconds

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
  const organization = useOrganization();
  const location = useLocation();

  // We connect traces over a 1h period - As we don't have timestamps of the linked trace, it is calculated based on this timeframe
  const linkedTraceWindowTimestamp =
    direction === 'previous'
      ? currentTraceStartTimestamp - LINKED_TRACE_MAX_DURATION // Earliest start time of previous trace (- 1h)
      : currentTraceStartTimestamp + LINKED_TRACE_MAX_DURATION; // Latest end time of next trace (+ 1h)

  const {
    adjacentTraceEndTimestamp,
    adjacentTraceStartTimestamp,
    iconDirection,
    ariaLabel,
    title,
  } = useMemo(() => {
    if (direction === 'previous') {
      return {
        adjacentTraceEndTimestamp: currentTraceStartTimestamp,
        adjacentTraceStartTimestamp: linkedTraceWindowTimestamp,
        iconDirection: 'left' as const,
        ariaLabel: t('Previous Trace'),
        title: tct(`Go to the previous trace of the same session. [link:Learn More]`, {
          link: (
            <ExternalLink href="https://docs.sentry.io/concepts/key-terms/tracing/trace-view/#previous-and-next-traces" />
          ),
        }),
      };
    }
    return {
      adjacentTraceEndTimestamp: linkedTraceWindowTimestamp,
      adjacentTraceStartTimestamp: currentTraceStartTimestamp,
      iconDirection: 'right' as const,
      ariaLabel: t('Next Trace'),
      title: tct(`Go to the next trace of the same session. [link:Learn More]`, {
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
    isLoading: isTraceLoading,
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

  const traceDispatch = useTraceStateDispatch();

  function closeSpanDetailsDrawer() {
    traceDispatch({
      type: 'minimize drawer',
      payload: true,
    });
  }

  return (
    <LinkButton
      size="xs"
      icon={<IconChevron direction={iconDirection} />}
      aria-label={ariaLabel}
      tooltipProps={{
        position: 'top',
        delay: 400,
        isHoverable: true,
      }}
      title={title}
      onClick={closeSpanDetailsDrawer}
      disabled={!traceId || isTraceLoading || !isTraceAvailable}
      to={getTraceDetailsUrl({
        traceSlug: traceId ?? '',
        spanId: traceSpanId,
        dateSelection,
        timestamp: linkedTraceWindowTimestamp,
        location,
        organization,
      })}
    />
  );
}
