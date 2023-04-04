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
    return <TracePlaceholder height="20px" />;
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

const TracePlaceholder = styled(Placeholder)`
  width: auto;
  max-width: 300px;
`;

export default QuickTrace;
