import {useCallback, useContext} from 'react';
import styled from '@emotion/styled';

import Link from 'sentry/components/links/link';
import {generateTraceTarget} from 'sentry/components/quickTrace/utils';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Event} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {QuickTraceContext} from 'sentry/utils/performance/quickTrace/quickTraceContext';
import useOrganization from 'sentry/utils/useOrganization';

type TraceLinkProps = {
  event: Event;
};

export function TraceLink({event}: TraceLinkProps) {
  const organization = useOrganization();
  const quickTrace = useContext(QuickTraceContext);
  const handleTraceLink = useCallback(() => {
    trackAdvancedAnalyticsEvent('quick_trace.trace_id.clicked', {
      organization,
      source: 'issues',
    });
  }, [organization]);

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
}

const StyledLink = styled(Link)`
  margin-left: ${space(1)};
  font-size: ${p => p.theme.fontSizeSmall};
`;
