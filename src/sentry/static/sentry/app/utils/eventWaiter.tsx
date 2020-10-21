import * as React from 'react';
import * as Sentry from '@sentry/react';

import {analytics} from 'app/utils/analytics';
import {Client} from 'app/api';
import {Organization, Project, Group} from 'app/types';
import withApi from 'app/utils/withApi';

const DEFAULT_POLL_INTERVAL = 5000;

const recordAnalyticsFirstEvent = ({key, organization, project}) =>
  analytics(`onboarding_v2.${key}`, {
    org_id: parseInt(organization.id, 10),
    project: parseInt(project.id, 10),
  });

/**
 * Should no issue object be available (the first issue has expired) then it
 * will simply be boolean true. When no event has been received this will be
 * null. Otherwise it will be the group
 */
type FirstIssue = null | true | Group;

type Props = {
  api: Client;
  organization: Organization;
  project: Project;
  eventType: 'error' | 'transaction';
  disabled?: boolean;
  pollInterval?: number;
  onIssueReceived?: (props: {firstIssue: FirstIssue}) => void;
  onTransactionReceived?: (props: {firstIssue: FirstIssue}) => void;
  children: (props: {firstIssue: FirstIssue}) => React.ReactNode;
};

type State = {
  firstIssue: FirstIssue;
};

/**
 * This is a render prop component that can be used to wait for the first event
 * of a project to be received via polling.
 */
class EventWaiter extends React.Component<Props, State> {
  state: State = {
    firstIssue: null,
  };

  componentDidMount() {
    this.pollHandler();
    this.startPolling();
  }

  componentDidUpdate() {
    this.stopPolling();
    this.startPolling();
  }

  componentWillUnmount() {
    this.stopPolling();
  }

  intervalId: number | null = null;

  pollHandler = async () => {
    const {api, organization, project, eventType, onIssueReceived} = this.props;
    let firstEvent = null;
    let firstIssue: Group | boolean | null = null;

    try {
      const resp = await api.requestPromise(
        `/projects/${organization.slug}/${project.slug}/`
      );
      firstEvent = eventType === 'error' ? resp.firstEvent : resp.firstTransactionEvent;
    } catch (resp) {
      if (!resp) {
        return;
      }

      // This means org or project does not exist, we need to stop polling
      // Also stop polling on auth-related errors (403/401)
      if ([404, 403, 401, 0].includes(resp.status)) {
        // TODO: Add some UX around this... redirect? error message?
        this.stopPolling();
        return;
      }

      Sentry.setExtras({
        status: resp.status,
        detail: resp.responseJSON?.detail,
      });
      Sentry.captureException(new Error(`Error polling for first ${eventType} event`));
    }

    if (firstEvent === null || firstEvent === false) {
      return;
    }

    if (eventType === 'error') {
      // Locate the projects first issue group. The project.firstEvent field will
      // *not* include sample events, while just looking at the issues list will.
      // We will wait until the project.firstEvent is set and then locate the
      // event given that event datetime
      const issues: Group[] = await api.requestPromise(
        `/projects/${organization.slug}/${project.slug}/issues/`
      );

      // The event may have expired, default to true
      firstIssue = issues.find((issue: Group) => issue.firstSeen === firstEvent) || true;

      // noinspection SpellCheckingInspection
      recordAnalyticsFirstEvent({
        key: 'first_event_recieved',
        organization,
        project,
      });
    } else {
      firstIssue = firstEvent;
      // noinspection SpellCheckingInspection
      recordAnalyticsFirstEvent({
        key: 'first_transaction_recieved',
        organization,
        project,
      });
    }

    if (onIssueReceived) {
      onIssueReceived({firstIssue});
    }

    this.stopPolling();
    this.setState({firstIssue});
  };

  startPolling() {
    const {disabled, organization, project} = this.props;

    if (disabled || !organization || !project || this.state.firstIssue) {
      return;
    }

    this.intervalId = window.setInterval(
      this.pollHandler,
      this.props.pollInterval || DEFAULT_POLL_INTERVAL
    );
  }

  stopPolling() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  render() {
    return this.props.children({firstIssue: this.state.firstIssue});
  }
}

export default withApi(EventWaiter);
