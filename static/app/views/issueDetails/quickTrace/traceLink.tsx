import {useCallback, useContext} from 'react';
import styled from '@emotion/styled';

import Link from 'sentry/components/links/link';
import {generateTraceTarget} from 'sentry/components/quickTrace/utils';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Event} from 'sentry/types';
import {trackAnalyticsEvent} from 'sentry/utils/analytics';
import {QuickTraceContext} from 'sentry/utils/performance/quickTrace/quickTraceContext';
import useOrganization from 'sentry/utils/useOrganization';

type TraceLinkProps = {
  event: Event;
};

export const TraceLink = ({event}: TraceLinkProps) => {
  const organization = useOrganization();
  const quickTrace = useContext(QuickTraceContext);
  const handleTraceLink = useCallback(() => {
    trackAnalyticsEvent({
      eventKey: 'quick_trace.trace_id.clicked',
      eventName: 'Quick Trace: Trace ID clicked',
      organization_id: parseInt(organization.id, 10),
      source: 'issues',
    });
  }, [organization.id]);

  if (
    !quickTrace ||
    quickTrace.isLoading ||
    quickTrace.error ||
    quickTrace.type === 'empty'
  ) {
    return null;
  }
  return (
    <StyledLink to={generateTraceTarget(event, organization)} onClick={handleTraceLink}>
      {t('View Full Trace')}
    </StyledLink>
  );
};

const StyledLink = styled(Link)`
  margin-left: ${space(1)};
`;
