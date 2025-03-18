import {useMemo} from 'react';
import styled from '@emotion/styled';

import type {
  SpanLink,
  TraceContextType,
} from 'sentry/components/events/interfaces/spans/types';
import Link from 'sentry/components/links/link';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {Tooltip} from 'sentry/components/tooltip';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useTrace} from 'sentry/views/performance/newTraceDetails/traceApi/useTrace';
import {useTraceQueryParams} from 'sentry/views/performance/newTraceDetails/useTraceQueryParams';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';

function useIsTraceAvailable(traceLink?: SpanLink): {
  isAvailable: boolean;
  isLoading: boolean;
} {
  const queryParams = useTraceQueryParams();

  const trace = useTrace({
    traceSlug: traceLink?.trace_id,
    timestamp: queryParams.timestamp,
  });

  const isAvailable = useMemo(() => {
    if (!traceLink) {
      return false;
    }
    return Boolean(trace?.data?.transactions?.length);
  }, [traceLink, trace?.data?.transactions]);

  return {
    isAvailable,
    isLoading: trace.isLoading,
  };
}

type TraceLinkNavigationButtonProps = {
  // Currently, we only support previous but component can be used for 'next trace' in the future
  direction: 'previous'; // | 'next';
  isLoading?: boolean;
  traceContext?: TraceContextType;
};

export function TraceLinkNavigationButton({
  direction,
  traceContext,
  isLoading,
}: TraceLinkNavigationButtonProps) {
  const organization = useOrganization();
  const location = useLocation();

  const traceLink = traceContext?.links?.find(
    link => link.attributes?.['sentry.link.type'] === `${direction}_trace`
  );

  const dateSelection = useMemo(
    () => normalizeDateTimeParams(location.query),
    [location.query]
  );

  const isLinkedTraceAvailable = useIsTraceAvailable(traceLink);

  if (isLoading) {
    // We don't show a placeholder/skeleton here as it would cause layout shifts most of the time.
    // Most traces don't have a next/previous trace and the hard to avoid layout shift should only occur if the actual button can be shown.
    return null;
  }

  if (!traceLink || !isLinkedTraceAvailable) {
    return null;
  }

  if (!traceLink.sampled) {
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

  return (
    <TraceLink
      color="gray500"
      to={getTraceDetailsUrl({
        traceSlug: traceLink.trace_id,
        spanId: traceLink.span_id,
        dateSelection,
        location,
        organization,
      })}
    >
      <IconChevron direction="left" />
      <TraceLinkText>{t('Go to Previous Trace')}</TraceLinkText>
    </TraceLink>
  );
}

const StyledTooltip = styled(Tooltip)`
  padding: ${space(0.5)} ${space(1)};
  text-decoration: underline dotted
    ${p => (p.disabled ? p.theme.gray300 : p.theme.gray300)};
`;

const TraceLink = styled(Link)`
  font-weight: ${p => p.theme.fontWeightNormal};
  color: ${p => p.theme.subText};
  padding: ${space(0.25)} ${space(0.5)};
  display: flex;
  align-items: center;
`;

const TraceLinkText = styled('span')`
  line-height: normal;
`;
