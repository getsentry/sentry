import styled from '@emotion/styled';
import {Location} from 'history';

import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import ErrorBoundary from 'sentry/components/errorBoundary';
import ExternalLink from 'sentry/components/links/externalLink';
import QuickTrace from 'sentry/components/quickTrace';
import {IconClose} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {Event} from 'sentry/types/event';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {QuickTraceQueryChildrenProps} from 'sentry/utils/performance/quickTrace/types';
import usePromptCheck from 'sentry/views/issueDetails/quickTrace/usePromptCheck';

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
            aria-label={t('Remind me later')}
            title={t('Dismiss for a month')}
            priority="link"
            size="xs"
            icon={<IconClose />}
            onClick={snoozePrompt}
          />
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

const QuickTraceWrapper = styled('div')`
  margin-top: ${space(0.5)};
`;

const StyledAlert = styled(Alert)`
  margin: ${space(1)} 0;
`;

export default IssueQuickTrace;
