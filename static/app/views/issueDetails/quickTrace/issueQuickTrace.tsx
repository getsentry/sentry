import styled from '@emotion/styled';
import {Location} from 'history';

import ErrorBoundary from 'sentry/components/errorBoundary';
import QuickTrace from 'sentry/components/quickTrace';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import {QuickTraceQueryChildrenProps} from 'sentry/utils/performance/quickTrace/types';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {TraceLink} from 'sentry/views/issueDetails/quickTrace/traceLink';

type Props = {
  event: Event;
  location: Location;
  organization: Organization;
  quickTrace: undefined | QuickTraceQueryChildrenProps;
};

function IssueQuickTrace({event, location, organization, quickTrace}: Props) {
  const isTraceMissing =
    !quickTrace ||
    quickTrace.error ||
    !defined(quickTrace.trace) ||
    quickTrace.trace.length === 0;

  useRouteAnalyticsParams({
    trace_status: isTraceMissing
      ? quickTrace?.type === 'missing'
        ? 'transaction missing'
        : 'trace missing'
      : 'success',
  });

  if (isTraceMissing) {
    return null;
  }

  return (
    <ErrorBoundary mini>
      <QuickTraceWrapper>
        <QuickTrace
          event={event}
          quickTrace={quickTrace}
          location={location}
          organization={organization}
          anchor="left"
          errorDest="issue"
          transactionDest="performance"
        />
        <TraceLink event={event} />
      </QuickTraceWrapper>
    </ErrorBoundary>
  );
}

const QuickTraceWrapper = styled('div')`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  margin-top: ${space(0.75)};
`;

export default IssueQuickTrace;
