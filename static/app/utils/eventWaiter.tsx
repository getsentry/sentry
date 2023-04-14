import {Component} from 'react';
import * as Sentry from '@sentry/react';

import {Client} from 'sentry/api';
import {Group, Organization, Project} from 'sentry/types';
import withApi from 'sentry/utils/withApi';

const DEFAULT_POLL_INTERVAL = 5000;

/**
 * When no event has been received this will be set to null or false.
 * Otherwise it will be the Group of the issue that was received.
 * Or in the case of transactions & replay the value will be set to true.
 * The `group.id` value is used to generate links directly into the event.
 */
type FirstIssue = null | boolean | Group;

export interface EventWaiterProps {
  api: Client;
  children: (props: {firstIssue: FirstIssue}) => React.ReactNode;
  eventType: 'error' | 'transaction' | 'replay' | 'profile';
  organization: Organization;
  project: Project;
  disabled?: boolean;
  onIssueReceived?: (props: {firstIssue: FirstIssue}) => void;
  onTransactionReceived?: (props: {firstIssue: FirstIssue}) => void;
  pollInterval?: number;
}

type EventWaiterState = {
  firstIssue: FirstIssue;
};

function getFirstEvent(eventType: EventWaiterProps['eventType'], resp: Project) {
  switch (eventType) {
    case 'error':
      return resp.firstEvent;
    case 'transaction':
      return resp.firstTransactionEvent;
    case 'replay':
      return resp.hasReplays;
    case 'profile':
      return resp.hasProfiles;
    default:
      return null;
  }
}

/**
 * This is a render prop component that can be used to wait for the first event
 * of a project to be received via polling.
 */
class EventWaiter extends Component<EventWaiterProps, EventWaiterState> {
  state: EventWaiterState = {
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

  pollingInterval: number | null = null;

  pollHandler = async () => {
    const {api, organization, project, eventType, onIssueReceived} = this.props;
    let firstEvent: string | boolean | null = null;
    let firstIssue: Group | boolean | null = null;

    try {
      const resp = await api.requestPromise(
        `/projects/${organization.slug}/${project.slug}/`
      );
      firstEvent = getFirstEvent(eventType, resp);
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
    } else if (eventType === 'transaction') {
      firstIssue = Boolean(firstEvent);
    } else if (eventType === 'replay') {
      firstIssue = Boolean(firstEvent);
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

    // Proactively clear interval just in case stopPolling was not called
    if (this.pollingInterval) {
      window.clearInterval(this.pollingInterval);
    }

    this.pollingInterval = window.setInterval(
      this.pollHandler,
      this.props.pollInterval || DEFAULT_POLL_INTERVAL
    );
  }

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
  }

  render() {
    return this.props.children({firstIssue: this.state.firstIssue});
  }
}

export default withApi(EventWaiter);
