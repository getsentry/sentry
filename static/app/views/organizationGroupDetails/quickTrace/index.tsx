import {Fragment, useContext} from 'react';
import {Location} from 'history';

import {Group, Organization} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {QuickTraceContext} from 'sentry/utils/performance/quickTrace/quickTraceContext';

import DistributedTracingPrompt from './configureDistributedTracing';
import IssueQuickTrace from './issueQuickTrace';

type Props = {
  event: Event;
  group: Group;
  location: Location;
  organization: Organization;
  isPerformanceIssue?: boolean;
};

function QuickTrace({event, group, organization, location, isPerformanceIssue}: Props) {
  const hasPerformanceView = organization.features.includes('performance-view');
  const hasTraceContext = Boolean(event.contexts?.trace?.trace_id);
  const quickTrace = useContext(QuickTraceContext);

  return (
    <Fragment>
      {!hasTraceContext && (
        <DistributedTracingPrompt
          event={event}
          project={group.project}
          organization={organization}
        />
      )}
      {hasPerformanceView && hasTraceContext && (
        <IssueQuickTrace
          organization={organization}
          event={event}
          location={location}
          isPerformanceIssue={isPerformanceIssue}
          quickTrace={quickTrace!}
        />
      )}
    </Fragment>
  );
}

export default QuickTrace;
