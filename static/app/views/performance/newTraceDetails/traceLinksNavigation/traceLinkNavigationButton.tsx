import {useMemo} from 'react';
import styled from '@emotion/styled';

import {ExternalLink, Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {IconChevron} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {
  useFindNextTrace,
  useFindPreviousTrace,
} from 'sentry/views/performance/newTraceDetails/traceLinksNavigation/useFindNextTrace';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';

export type ConnectedTraceConnection = 'previous' | 'next';

const LINKED_TRACE_MAX_DURATION = 3600; // 1h in seconds

type TraceLinkNavigationButtonProps = {
  currentTraceTimestamps: {end?: number; start?: number};
  direction: ConnectedTraceConnection;
  attributes?: TraceItemResponseAttribute[];
  isLoading?: boolean;
};

export function TraceLinkNavigationButton({
  direction,
  attributes,
  isLoading: isWaterfallLoading,
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

  const {
    available: isPreviousTraceAvailable,
    id: previousTraceSpanId,
    trace: previousTraceId,
    sampled: previousTraceSampled,
    isLoading: isPreviousTraceLoading,
  } = useFindPreviousTrace({
    direction,
    linkedTraceTimestamp,
    attributes,
  });

  const {
    id: nextTraceSpanId,
    trace: nextTraceId,
    isLoading: isNextTraceLoading,
  } = useFindNextTrace({
    direction,
    nextTraceEndTimestamp: currentTraceTimestamps.end ?? 0,
    nextTraceStartTimestamp: linkedTraceTimestamp ?? 0,
    attributes,
  });

  const dateSelection = useMemo(
    () => normalizeDateTimeParams(location.query),
    [location.query]
  );

  if (isWaterfallLoading) {
    return <PlaceHolder />;
  }

  if (direction === 'previous' && previousTraceId && !isPreviousTraceLoading) {
    if (isPreviousTraceAvailable) {
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
              traceSlug: previousTraceId,
              spanId: previousTraceSpanId,
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

    if (!previousTraceSampled) {
      return (
        <StyledTooltip
          position="right"
          title={t(
            'Trace contains a link to an unsampled trace. Increase traces sample rate in SDK settings to see more connected traces'
          )}
        >
          <TraceLinkText>{t('Previous trace not sampled')}</TraceLinkText>
        </StyledTooltip>
      );
    }

    if (!isPreviousTraceAvailable) {
      return (
        <StyledTooltip
          position="right"
          title={t(
            'Trace contains a link to a trace that is not available. This means that the trace was not stored.'
          )}
        >
          <TraceLinkText>{t('Previous trace not available')}</TraceLinkText>
        </StyledTooltip>
      );
    }
  }

  if (direction === 'next' && !isNextTraceLoading && nextTraceId && nextTraceSpanId) {
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
            traceSlug: nextTraceId,
            spanId: nextTraceSpanId,
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

  // If there's no linked trace, let's render a placeholder for now to avoid layout shifts
  // We should reconsider the place where we render these buttons, to avoid reducing the
  // waterfall height permanently
  return <PlaceHolder />;
}

function PlaceHolder() {
  return <PlaceHolderText>&nbsp;</PlaceHolderText>;
}

const PlaceHolderText = styled('span')`
  padding: ${space(0.5)} ${space(0.5)};
  visibility: hidden;
`;

const StyledTooltip = styled(Tooltip)`
  padding: ${space(0.5)} ${space(0.5)};
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
