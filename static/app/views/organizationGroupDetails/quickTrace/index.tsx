import {useContext} from 'react';
import {Location} from 'history';

import ReplayNode from 'sentry/components/quickTrace/replayNode';
import {ReplayOnlyTrace} from 'sentry/components/quickTrace/styles';
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

  const hasReplay =
    event.entries?.some(({type}) => type === 'breadcrumbs') &&
    event.tags?.some(({key, value}) => key === 'replayId' && Boolean(value));
  const isReplayEnabled = organization.features.includes('session-replay-ui');
  const showQuickTrace = hasPerformanceView && hasTraceContext;

  if (showQuickTrace) {
    return (
      <IssueQuickTrace
        organization={organization}
        event={event}
        location={location}
        isPerformanceIssue={isPerformanceIssue}
        quickTrace={quickTrace!}
      />
    );
  }

  return hasReplay && isReplayEnabled ? (
    <ReplayOnlyTrace>
      <ReplayNode event={event} />
    </ReplayOnlyTrace>
  ) : null;
}

export default QuickTrace;
