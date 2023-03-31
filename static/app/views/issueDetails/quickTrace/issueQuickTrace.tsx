import {useEffect} from 'react';
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
import {Tooltip} from 'sentry/components/tooltip';
import {IconFire} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Group, IssueCategory, Organization} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {QuickTraceQueryChildrenProps} from 'sentry/utils/performance/quickTrace/types';
import useOrganization from 'sentry/utils/useOrganization';
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
  group,
}: {
  group: Group;
  type?: QuickTraceQueryChildrenProps['type'];
}) {
  const organization = useOrganization();
  useEffect(() => {
    trackAdvancedAnalyticsEvent('issue.quick_trace_status', {
      organization,
      status: type === 'missing' ? 'transaction missing' : 'trace missing',
      is_performance_issue: group.issueCategory === IssueCategory.PERFORMANCE,
    });
  });

  return (
    <QuickTraceWrapper>
      <Tooltip
        isHoverable
        position="bottom"
        title={tct(
          'The [type] for this event cannot be found. [link:Read the  docs] to understand why.',
          {
            type: type === 'missing' ? t('transaction') : t('trace'),
            link: (
              <ExternalLink href="https://docs.sentry.io/product/sentry-basics/tracing/trace-view/#troubleshooting" />
            ),
          }
        )}
      >
        <QuickTraceContainer data-test-id="missing-trace-placeholder">
          <EventNode type="white" icon={null}>
            ???
          </EventNode>
          <TraceConnector />
          <EventNode type="error" data-test-id="event-node">
            <ErrorNodeContent>
              <IconFire size="xs" />
              {t('This Event')}
            </ErrorNodeContent>
          </EventNode>
        </QuickTraceContainer>
      </Tooltip>
    </QuickTraceWrapper>
  );
}

function IssueQuickTrace({group, event, location, organization, quickTrace}: Props) {
  if (
    !quickTrace ||
    quickTrace.error ||
    !defined(quickTrace.trace) ||
    quickTrace.trace.length === 0
  ) {
    return <TransactionMissingPlaceholder group={group} type={quickTrace?.type} />;
  }

  trackAdvancedAnalyticsEvent('issue.quick_trace_status', {
    organization,
    status: 'success',
    is_performance_issue: group.issueCategory === IssueCategory.PERFORMANCE,
  });

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
  margin-top: ${space(0.5)};
`;

export default IssueQuickTrace;
