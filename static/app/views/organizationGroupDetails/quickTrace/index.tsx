import {Fragment, useContext} from 'react';
import {Location} from 'history';

import {Group, Organization, Project} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {QuickTraceContext} from 'sentry/utils/performance/quickTrace/quickTraceContext';

import IssueQuickTrace from './issueQuickTrace';

type Props = {
  event: Event;
  group: Group;
  location: Location;
  organization: Organization;
  isPerformanceIssue?: boolean;
  project?: Project;
};

function QuickTrace({event, organization, project, location, isPerformanceIssue}: Props) {
  const hasPerformanceView = organization.features.includes('performance-view');
  const hasTraceContext = Boolean(event.contexts?.trace?.trace_id);
  const quickTrace = useContext(QuickTraceContext);

  return (
    <Fragment>
      {hasPerformanceView && hasTraceContext && (
        <IssueQuickTrace
          organization={organization}
          project={project}
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
