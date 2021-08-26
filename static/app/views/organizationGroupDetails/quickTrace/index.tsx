import {Fragment} from 'react';
import {Location} from 'history';

import {Group, Organization} from 'app/types';
import {Event} from 'app/types/event';

import DistributedTracingPrompt from './configureDistributedTracing';
import IssueQuickTrace from './issueQuickTrace';

type Props = {
  event: Event;
  group: Group;
  organization: Organization;
  location: Location;
};

export default function QuickTrace({event, group, organization, location}: Props) {
  const hasPerformanceView = organization.features.includes('performance-view');
  const hasTraceContext = Boolean(event.contexts?.trace?.trace_id);

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
        <IssueQuickTrace organization={organization} event={event} location={location} />
      )}
    </Fragment>
  );
}
