import {useMemo} from 'react';

import {LinkButton} from '@sentry/scraps/button/linkButton';

import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
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
    available: isPreviousTraceAvailable,
    id: previousTraceSpanId,
    trace: previousTraceId,
    isLoading: isPreviousTraceLoading,
  } = useFindAdjacentTrace({
    direction: 'previous',
    adjacentTraceEndTimestamp: currentTraceStartTimestamp,
    adjacentTraceStartTimestamp: linkedTraceWindowTimestamp,
    attributes,
  });

  const {
    available: isNextTraceAvailable,
    id: nextTraceSpanId,
    trace: nextTraceId,
    isLoading: isNextTraceLoading,
  } = useFindAdjacentTrace({
    direction: 'next',
    adjacentTraceEndTimestamp: linkedTraceWindowTimestamp,
    adjacentTraceStartTimestamp: currentTraceStartTimestamp,
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

  if (direction === 'previous') {
    return (
      <LinkButton
        size="xs"
        icon={<IconChevron direction="left" />}
        aria-label={t('Previous Trace')}
        onClick={() => closeSpanDetailsDrawer()}
        disabled={!previousTraceId || isPreviousTraceLoading || !isPreviousTraceAvailable}
        to={getTraceDetailsUrl({
          traceSlug: previousTraceId ?? '',
          spanId: previousTraceSpanId,
          dateSelection,
          timestamp: linkedTraceWindowTimestamp,
          location,
          organization,
        })}
      />
    );
  }

  if (direction === 'next') {
    return (
      <LinkButton
        size="xs"
        icon={<IconChevron direction="right" />}
        aria-label={t('Next Trace')}
        onClick={closeSpanDetailsDrawer}
        disabled={!nextTraceId || isNextTraceLoading || !isNextTraceAvailable}
        to={getTraceDetailsUrl({
          traceSlug: nextTraceId ?? '',
          spanId: nextTraceSpanId,
          dateSelection,
          timestamp: linkedTraceWindowTimestamp,
          location,
          organization,
        })}
      />
    );
  }

  return null;
}
