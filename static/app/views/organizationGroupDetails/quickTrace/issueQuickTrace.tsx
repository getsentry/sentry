import {Component, Fragment} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {promptsCheck, promptsUpdate} from 'sentry/actionCreators/prompts';
import {Client} from 'sentry/api';
import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import ErrorBoundary from 'sentry/components/errorBoundary';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import Placeholder from 'sentry/components/placeholder';
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
import {promptIsDismissed} from 'sentry/utils/promptIsDismissed';
import withApi from 'sentry/utils/withApi';

type Props = {
  api: Client;
  event: Event;
  location: Location;
  organization: Organization;
  quickTrace: QuickTraceQueryChildrenProps;
  isPerformanceIssue?: boolean;
};

type State = {
  shouldShow: boolean | null;
};

class IssueQuickTrace extends Component<Props, State> {
  state: State = {
    shouldShow: null,
  };

  componentDidMount() {
    this.promptsCheck();
  }

  shouldComponentUpdate(nextProps, nextState: State) {
    return (
      this.props.event !== nextProps.event ||
      this.state.shouldShow !== nextState.shouldShow ||
      this.props.quickTrace !== nextProps.quickTrace
    );
  }

  async promptsCheck() {
    const {api, event, organization} = this.props;

    const data = await promptsCheck(api, {
      organizationId: organization.id,
      projectId: event.projectID,
      feature: 'quick_trace_missing',
    });

    this.setState({shouldShow: !promptIsDismissed(data ?? {}, 30)});
  }

  handleTraceLink(organization: Organization) {
    trackAnalyticsEvent({
      eventKey: 'quick_trace.trace_id.clicked',
      eventName: 'Quick Trace: Trace ID clicked',
      organization_id: parseInt(organization.id, 10),
      source: 'issues',
    });
  }

  renderTraceLink({isLoading, error, trace, type}) {
    const {event, organization} = this.props;

    if (isLoading || error !== null || trace === null || type === 'empty') {
      return null;
    }

    return (
      <LinkContainer>
        <Link
          to={generateTraceTarget(event, organization)}
          onClick={() => this.handleTraceLink(organization)}
        >
          {t('View Full Trace')}
        </Link>
      </LinkContainer>
    );
  }

  snoozePrompt = () => {
    const {api, event, organization} = this.props;
    const data = {
      projectId: event.projectID,
      organizationId: organization.id,
      feature: 'quick_trace_missing',
      status: 'snoozed' as const,
    };
    promptsUpdate(api, data).then(() => this.setState({shouldShow: false}));
  };

  renderQuickTrace(results: QuickTraceQueryChildrenProps) {
    const {event, location, organization, isPerformanceIssue} = this.props;
    const {shouldShow} = this.state;
    const {isLoading, error, trace, type} = results;

    if (isLoading) {
      return <Placeholder height="24px" />;
    }

    if (error || trace === null || trace.length === 0) {
      if (!shouldShow) {
        return null;
      }

      trackAdvancedAnalyticsEvent('issue.quick_trace_status', {
        organization,
        status: type === 'missing' ? 'transaction missing' : 'trace missing',
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
              onClick={this.snoozePrompt}
            >
              <IconClose />
            </Button>
          }
        >
          {tct(
            'The [type] for this event cannot be found. [link:Read the docs to understand why].',
            {
              type: type === 'missing' ? t('transaction') : t('trace'),
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
      <Fragment>
        {this.renderTraceLink(results)}
        <QuickTraceWrapper>
          <QuickTrace
            event={event}
            quickTrace={results}
            location={location}
            organization={organization}
            anchor="left"
            errorDest="issue"
            transactionDest="performance"
          />
        </QuickTraceWrapper>
      </Fragment>
    );
  }

  render() {
    const {quickTrace} = this.props;

    return <ErrorBoundary mini>{this.renderQuickTrace(quickTrace)}</ErrorBoundary>;
  }
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

export default withApi(IssueQuickTrace);
