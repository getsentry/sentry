import {useCallback} from 'react';
import styled from '@emotion/styled';

import Link from 'sentry/components/links/link';
import {generateTraceTarget} from 'sentry/components/quickTrace/utils';
import {tct, tn} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getShortEventId} from 'sentry/utils/events';
import type {QuickTraceContextChildrenProps} from 'sentry/utils/performance/quickTrace/quickTraceContext';
import type {TraceMeta} from 'sentry/utils/performance/quickTrace/types';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

type TraceLinkProps = {
  event: Event;
  quickTrace: QuickTraceContextChildrenProps;
  source: 'events' | 'issues';
  traceMeta: TraceMeta | null;
};

export function TraceLink({event, traceMeta, source, quickTrace}: TraceLinkProps) {
  const organization = useOrganization();
  const location = useLocation();
  const traceTarget = generateTraceTarget(event, organization, location);
  const traceId = event.contexts?.trace?.trace_id ?? '';
  const handleTraceLink = useCallback(() => {
    trackAnalytics('quick_trace.trace_id.clicked', {
      organization,
      source,
    });
  }, [organization, source]);

  if (
    !quickTrace ||
    quickTrace.isLoading ||
    quickTrace.error ||
    quickTrace.type === 'empty'
  ) {
    return null;
  }

  return (
    <StyledLink to={traceTarget} onClick={handleTraceLink}>
      {tct('View Full Trace: [id][events]', {
        id: getShortEventId(traceId ?? ''),
        events: traceMeta
          ? tn(' (%s event)', ' (%s events)', traceMeta.transactions + traceMeta.errors)
          : '',
      })}
    </StyledLink>
  );
}

const StyledLink = styled(Link)`
  font-size: ${p => p.theme.fontSizeSmall};
`;
