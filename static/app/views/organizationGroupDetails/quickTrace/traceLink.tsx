import {useCallback, useContext} from 'react';
import {Link} from 'react-router';

import {generateTraceTarget} from 'sentry/components/quickTrace/utils';
import {t} from 'sentry/locale';
import {Event} from 'sentry/types';
import {trackAnalyticsEvent} from 'sentry/utils/analytics';
import {QuickTraceContext} from 'sentry/utils/performance/quickTrace/quickTraceContext';
import useOrganization from 'sentry/utils/useOrganization';
import LinkContainer from 'sentry/views/organizationGroupDetails/eventToolbar/linkContainer';

type TraceLinkProps = {
  event: Event;
};

export function TraceLink({event}: TraceLinkProps) {
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
    <LinkContainer>
      <Link to={generateTraceTarget(event, organization)} onClick={handleTraceLink}>
        {t('View Full Trace')}
      </Link>
    </LinkContainer>
  );
}
