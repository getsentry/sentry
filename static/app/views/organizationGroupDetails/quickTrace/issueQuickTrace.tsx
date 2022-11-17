import {useCallback} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import ErrorBoundary from 'sentry/components/errorBoundary';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import QuickTrace from 'sentry/components/quickTrace';
import {generateTraceTarget} from 'sentry/components/quickTrace/utils';
import {IconClose} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {trackAnalyticsEvent} from 'sentry/utils/analytics';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {QuickTraceQueryChildrenProps} from 'sentry/utils/performance/quickTrace/types';
import usePromptCheck from 'sentry/views/organizationGroupDetails/quickTrace/usePromptCheck';

type Props = {
  event: Event;
  location: Location;
  organization: Organization;
  quickTrace: undefined | QuickTraceQueryChildrenProps;
  isPerformanceIssue?: boolean;
};

function IssueQuickTrace({
  event,
  location,
  organization,
  quickTrace,
  isPerformanceIssue,
}: Props) {
  const {shouldShowPrompt, snoozePrompt} = usePromptCheck({
    projectId: event.projectID,
    feature: 'quick_trace_missing',
    organization,
  });

  if (
    !quickTrace ||
    quickTrace.error ||
    quickTrace.trace === null ||
    quickTrace.trace.length === 0
  ) {
    if (!shouldShowPrompt) {
      return null;
    }

    trackAdvancedAnalyticsEvent('issue.quick_trace_status', {
      organization,
      status: quickTrace?.type === 'missing' ? 'transaction missing' : 'trace missing',
      is_performance_issue: isPerformanceIssue ?? false,
    });

    return (
      <StyledAlert
        type="info"
        showIcon
        trailingItems={
          <Button
            priority="link"
            size="zero"
            title={t('Dismiss for a month')}
            onClick={snoozePrompt}
          >
            <IconClose />
          </Button>
        }
      >
        {tct(
          'The [type] for this event cannot be found. [link:Read the docs to understand why].',
          {
            type: quickTrace?.type === 'missing' ? t('transaction') : t('trace'),
            link: (
              <ExternalLink href="https://docs.sentry.io/product/sentry-basics/tracing/trace-view/#troubleshooting" />
            ),
          }
        )}
      </StyledAlert>
    );
  }

  trackAdvancedAnalyticsEvent('issue.quick_trace_status', {
    organization,
    status: 'success',
    is_performance_issue: isPerformanceIssue ?? false,
  });

  return (
    <ErrorBoundary mini>
      {quickTrace.type !== 'empty' ? (
        <TraceLink event={event} organization={organization} />
      ) : null}
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
      </QuickTraceWrapper>
    </ErrorBoundary>
  );
}

type TraceLinkProps = {
  event: Event;
  organization: Organization;
};

function TraceLink({event, organization}: TraceLinkProps) {
  const handleTraceLink = useCallback(() => {
    trackAnalyticsEvent({
      eventKey: 'quick_trace.trace_id.clicked',
      eventName: 'Quick Trace: Trace ID clicked',
      organization_id: parseInt(organization.id, 10),
      source: 'issues',
    });
  }, [organization.id]);

  return (
    <LinkContainer>
      <Link to={generateTraceTarget(event, organization)} onClick={handleTraceLink}>
        {t('View Full Trace')}
      </Link>
    </LinkContainer>
  );
}

const LinkContainer = styled('span')`
  margin-left: ${space(1)};
  padding-left: ${space(1)};
  position: relative;

  &:before {
    display: block;
    position: absolute;
    content: '';
    left: 0;
    top: 2px;
    height: 14px;
    border-left: 1px solid ${p => p.theme.border};
  }
`;

const QuickTraceWrapper = styled('div')`
  margin-top: ${space(0.5)};
`;

const StyledAlert = styled(Alert)`
  margin: 0;
`;

export default IssueQuickTrace;
