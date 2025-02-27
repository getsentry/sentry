import styled from '@emotion/styled';

import type {TraceContextType} from 'sentry/components/events/interfaces/spans/types';
import Link from 'sentry/components/links/link';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {Tooltip} from 'sentry/components/tooltip';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';

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

  const dateSelection = normalizeDateTimeParams(location.query);

  if (isLoading) {
    return <TraceLinkSkeleton>{t('Fetching previous trace...')}</TraceLinkSkeleton>;
  }

  if (!traceLink) {
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

const TraceLinkSkeleton = styled('div')`
  background: ${p => p.theme.gray100};
  border-radius: 4px;
  animation: pulse 2s ease-out infinite;
  padding: ${space(0.5)} ${space(1)};

  @keyframes pulse {
    0% {
      opacity: 0.4;
    }
    50% {
      opacity: 0.9;
    }
    100% {
      opacity: 0.4;
    }
  }
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
