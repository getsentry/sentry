import styled from '@emotion/styled';
import {Location} from 'history';

import ErrorBoundary from 'sentry/components/errorBoundary';
import ExternalLink from 'sentry/components/links/externalLink';
import QuickTrace from 'sentry/components/quickTrace';
import {
  ErrorNodeContent,
  EventNode,
  QuickTraceContainer,
  TraceConnector,
} from 'sentry/components/quickTrace/styles';
import {IconFire} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Group, Organization} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import {QuickTraceQueryChildrenProps} from 'sentry/utils/performance/quickTrace/types';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {TraceLink} from 'sentry/views/issueDetails/quickTrace/traceLink';

type Props = {
  event: Event;
  group: Group;
  location: Location;
  organization: Organization;
  quickTrace: undefined | QuickTraceQueryChildrenProps;
};

function TransactionMissingPlaceholder({
  type,
  event,
}: {
  event: Event;
  type?: QuickTraceQueryChildrenProps['type'];
}) {
  useRouteAnalyticsParams({
    trace_status: type === 'missing' ? 'transaction missing' : 'trace missing',
  });

  return (
    <QuickTraceWrapper>
      <QuickTraceContainer data-test-id="missing-trace-placeholder">
        <EventNode
          type="white"
          icon={null}
          tooltipProps={{isHoverable: true, position: 'bottom'}}
          tooltipText={tct(
            'The [type] for this event cannot be found. [link:Read the  docs] to understand why.',
            {
              type: type === 'missing' ? t('transaction') : t('trace'),
              link: (
                <ExternalLink href="https://docs.sentry.io/product/sentry-basics/tracing/trace-view/#troubleshooting" />
              ),
            }
          )}
        >
          ???
        </EventNode>
        <TraceConnector />
        <EventNode type="error" data-test-id="event-node">
          <ErrorNodeContent>
            <IconFire size="xs" />
            {t('This Event')}
          </ErrorNodeContent>
        </EventNode>
        <TraceLink event={event} />
      </QuickTraceContainer>
    </QuickTraceWrapper>
  );
}

function IssueQuickTrace({event, location, organization, quickTrace}: Props) {
  const shouldShowPlaceholder =
    !quickTrace ||
    quickTrace.error ||
    !defined(quickTrace.trace) ||
    quickTrace.trace.length === 0;

  useRouteAnalyticsParams(shouldShowPlaceholder ? {} : {trace_status: 'success'});

  if (shouldShowPlaceholder) {
    return <TransactionMissingPlaceholder event={event} type={quickTrace?.type} />;
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
