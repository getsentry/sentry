import {useContext} from 'react';
import styled from '@emotion/styled';
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
};

function QuickTrace({group, event, organization, location}: Props) {
  const hasPerformanceView = organization.features.includes('performance-view');
  const hasTraceContext = Boolean(event.contexts?.trace?.trace_id);
  const quickTrace = useContext(QuickTraceContext);

  if (!hasPerformanceView || !hasTraceContext) {
    return null;
  }

  if (quickTrace?.isLoading) {
    return <GrowingPlaceholder height="24px" />;
  }

  return (
    <IssueQuickTrace
      organization={organization}
      event={event}
      location={location}
      group={group}
      quickTrace={quickTrace}
    />
  );
}

const GrowingPlaceholder = styled(Placeholder)`
  flex-grow: 1;
  width: auto;
`;

export default QuickTrace;
