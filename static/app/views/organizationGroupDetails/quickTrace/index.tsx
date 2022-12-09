import {useContext} from 'react';
import {Location} from 'history';

import Placeholder from 'sentry/components/placeholder';
import {Group, Organization} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {QuickTraceContext} from 'sentry/utils/performance/quickTrace/quickTraceContext';

import IssueQuickTrace from './issueQuickTrace';

type Props = {
  event: Event;
  group: Group;
  location: Location;
  organization: Organization;
  isPerformanceIssue?: boolean;
};

function QuickTrace({event, organization, location, isPerformanceIssue}: Props) {
  const hasPerformanceView = organization.features.includes('performance-view');
  const hasTraceContext = Boolean(event.contexts?.trace?.trace_id);
  const quickTrace = useContext(QuickTraceContext);

  if (!hasPerformanceView || !hasTraceContext) {
    return null;
  }

  if (quickTrace?.isLoading) {
    return <Placeholder height="24px" />;
  }

  return (
    <IssueQuickTrace
      organization={organization}
      event={event}
      location={location}
      isPerformanceIssue={isPerformanceIssue}
      quickTrace={quickTrace}
    />
  );
}

export default QuickTrace;
