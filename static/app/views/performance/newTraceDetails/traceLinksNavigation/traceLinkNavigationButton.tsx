import {useMemo} from 'react';
import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/core/tooltip';
import type {
  SpanLink,
  TraceContextType,
} from 'sentry/components/events/interfaces/spans/types';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {IconChevron} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useTrace} from 'sentry/views/performance/newTraceDetails/traceApi/useTrace';
import {isEmptyTrace} from 'sentry/views/performance/newTraceDetails/traceApi/utils';
import {useFindNextTrace} from 'sentry/views/performance/newTraceDetails/traceLinksNavigation/useFindNextTrace';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';

export type ConnectedTraceConnection = 'previous' | 'next';

const LINKED_TRACE_MAX_DURATION = 3600; // 1h in seconds

function useIsTraceAvailable(
  traceID?: SpanLink['trace_id'],
  linkedTraceTimestamp?: number
): {
  isAvailable: boolean;
  isLoading: boolean;
} {
  const trace = useTrace({
    traceSlug: traceID,
    timestamp: linkedTraceTimestamp,
  });

  const isAvailable = useMemo(() => {
    if (!traceID) {
      return false;
    }

    return Boolean(trace.data && !isEmptyTrace(trace.data));
  }, [traceID, trace]);

  return {
    isAvailable,
    isLoading: trace.isLoading,
  };
}

type TraceLinkNavigationButtonProps = {
  currentTraceTimestamps: {end?: number; start?: number};
  direction: ConnectedTraceConnection;
  isLoading?: boolean;
  projectID?: string;
  traceContext?: TraceContextType;
};

export function TraceLinkNavigationButton({
  direction,
  traceContext,
  isLoading,
  projectID,
  currentTraceTimestamps,
}: TraceLinkNavigationButtonProps) {
  const organization = useOrganization();
  const location = useLocation();

  // We connect traces over a 1h period - As we don't have timestamps of the linked trace, it is calculated based on this timeframe
  const linkedTraceTimestamp =
    direction === 'previous' && currentTraceTimestamps.start
      ? currentTraceTimestamps.start - LINKED_TRACE_MAX_DURATION // Earliest start time of previous trace (- 1h)
      : direction === 'next' && currentTraceTimestamps.end
        ? currentTraceTimestamps.end + LINKED_TRACE_MAX_DURATION // Latest end time of next trace (+ 1h)
        : undefined;

  const previousTraceLink = traceContext?.links?.find(
    link => link.attributes?.['sentry.link.type'] === `${direction}_trace`
  );

  const nextTraceData = useFindNextTrace({
    direction,
    currentTraceID: traceContext?.trace_id,
    linkedTraceStartTimestamp: currentTraceTimestamps.end,
    linkedTraceEndTimestamp: linkedTraceTimestamp,
    projectID,
  });

  const dateSelection = useMemo(
    () => normalizeDateTimeParams(location.query),
    [location.query]
  );

  const {isAvailable: isLinkedTraceAvailable} = useIsTraceAvailable(
    direction === 'previous' ? previousTraceLink?.trace_id : nextTraceData?.trace_id,
    linkedTraceTimestamp
  );

  if (isLoading) {
    // We don't show a placeholder/skeleton here as it would cause layout shifts most of the time.
    // Most traces don't have a next/previous trace and the hard to avoid layout shift should only occur if the actual button can be shown.
    return null;
  }

  if (previousTraceLink && isLinkedTraceAvailable) {
    return (
      <StyledTooltip
        position="right"
        delay={400}
        isHoverable
        title={tct(
          `This links to the previous trace within the same session. To learn more, [link:read the docs].`,
          {
            link: (
              <ExternalLink
                href={
                  'https://docs.sentry.io/concepts/key-terms/tracing/trace-view/#previous-and-next-traces'
                }
              />
            ),
          }
        )}
      >
        <TraceLink
          color="gray500"
          to={getTraceDetailsUrl({
            traceSlug: previousTraceLink.trace_id,
            spanId: previousTraceLink.span_id,
            dateSelection,
            timestamp: linkedTraceTimestamp,
            location,
            organization,
          })}
        >
          <IconChevron direction="left" />
          <TraceLinkText>{t('Go to Previous Trace')}</TraceLinkText>
        </TraceLink>
      </StyledTooltip>
    );
  }

  if (nextTraceData?.trace_id && nextTraceData.span_id && isLinkedTraceAvailable) {
    return (
      <StyledTooltip
        position="left"
        delay={400}
        isHoverable
        title={tct(
          `This links to the next trace within the same session. To learn more, [link:read the docs].`,
          {
            link: (
              <ExternalLink
                href={
                  'https://docs.sentry.io/concepts/key-terms/tracing/trace-view/#previous-and-next-traces'
                }
              />
            ),
          }
        )}
      >
        <TraceLink
          color="gray500"
          to={getTraceDetailsUrl({
            traceSlug: nextTraceData.trace_id,
            spanId: nextTraceData.span_id,
            dateSelection,
            timestamp: linkedTraceTimestamp,
            location,
            organization,
          })}
        >
          <TraceLinkText>{t('Go to Next Trace')}</TraceLinkText>
          <IconChevron direction="right" />
        </TraceLink>
      </StyledTooltip>
    );
  }

  if (previousTraceLink?.sampled === false) {
    return (
      <StyledTooltip
        position="right"
        title={t(
          'Trace contains a link to unsampled trace. Increase traces sample rate in SDK settings to see more connected traces'
        )}
      >
        <TraceLinkText>{t('Previous trace not available')}</TraceLinkText>
      </StyledTooltip>
    );
  }

  // If there is no linked trace or an undefined sampling decision
  return null;
}

const StyledTooltip = styled(Tooltip)`
  padding: ${space(0.5)} ${space(1)};
  text-decoration: underline dotted
    ${p => (p.disabled ? p.theme.gray300 : p.theme.gray300)};
`;

const TraceLink = styled(Link)`
  font-weight: ${p => p.theme.fontWeight.normal};
  padding: ${space(0.25)} ${space(0.5)};
  display: flex;
  align-items: center;

  color: ${p => p.theme.subText};
  :hover {
    color: ${p => p.theme.subText};
  }
`;

const TraceLinkText = styled('span')`
  line-height: normal;
`;
