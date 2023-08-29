import {Fragment} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import ErrorBoundary from 'sentry/components/errorBoundary';
import QuickTrace from 'sentry/components/quickTrace';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import TraceMetaQuery from 'sentry/utils/performance/quickTrace/traceMetaQuery';
import {QuickTraceQueryChildrenProps} from 'sentry/utils/performance/quickTrace/types';
import {getTraceTimeRangeFromEvent} from 'sentry/utils/performance/quickTrace/utils';
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
    ((!defined(quickTrace.trace) || quickTrace.trace.length === 0) &&
      (!quickTrace.orphanErrors || quickTrace.orphanErrors?.length === 0));
  const traceId = event.contexts?.trace?.trace_id ?? '';
  const {start, end} = getTraceTimeRangeFromEvent(event);

  useRouteAnalyticsParams({
    trace_status: isTraceMissing
      ? quickTrace?.type === 'missing'
        ? 'transaction missing'
        : 'trace missing'
      : 'success',
  });

  if (isTraceMissing) {
    return (
      <QuickTraceWrapper>
        <TraceLink
          quickTrace={quickTrace}
          event={event}
          traceMeta={null}
          source="issues"
        />
      </QuickTraceWrapper>
    );
  }

  return (
    <ErrorBoundary mini>
      <QuickTraceWrapper>
        <TraceMetaQuery
          location={location}
          orgSlug={organization.slug}
          traceId={traceId}
          start={start}
          end={end}
        >
          {metaResults => (
            <Fragment>
              <QuickTrace
                event={event}
                quickTrace={quickTrace}
                location={location}
                organization={organization}
                anchor="left"
                errorDest="issue"
                transactionDest="performance"
              />
              <TraceLink
                quickTrace={quickTrace}
                event={event}
                traceMeta={metaResults?.meta ?? null}
                source="issues"
              />
            </Fragment>
          )}
        </TraceMetaQuery>
      </QuickTraceWrapper>
    </ErrorBoundary>
  );
}

const QuickTraceWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.75)};
  flex-wrap: wrap;
  margin-top: ${space(0.75)};
  height: 20px;
`;

export default IssueQuickTrace;
