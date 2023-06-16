import {useContext} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {Location} from 'history';

import Placeholder from 'sentry/components/placeholder';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {QuickTraceContext} from 'sentry/utils/performance/quickTrace/quickTraceContext';
import useMedia from 'sentry/utils/useMedia';

import IssueQuickTrace from './issueQuickTrace';

type Props = {
  event: Event;
  location: Location;
  organization: Organization;
};

function QuickTrace({event, organization, location}: Props) {
  const theme = useTheme();
  const hasPerformanceView = organization.features.includes('performance-view');
  const hasTraceContext = Boolean(event.contexts?.trace?.trace_id);
  const quickTrace = useContext(QuickTraceContext);

  const isSmallViewport = useMedia(`(max-width: ${theme.breakpoints.small})`);

  if (isSmallViewport || !hasPerformanceView || !hasTraceContext) {
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
      quickTrace={quickTrace}
    />
  );
}

const TracePlaceholder = styled(Placeholder)`
  width: auto;
  max-width: 300px;
  margin-top: ${space(0.75)};
`;

export default QuickTrace;
