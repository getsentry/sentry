import {Component} from 'react';
import * as Sentry from '@sentry/react';

import {Client} from 'sentry/api';
import {Group, Organization, Project} from 'sentry/types';
import {analytics} from 'sentry/utils/analytics';
import withApi from 'sentry/utils/withApi';

const DEFAULT_POLL_INTERVAL = 5000;

type EventType = 'error' | 'transaction' | 'replay' | 'profile';

type FirstEvents = {
  error: 'string' | null;
  profile: boolean;
  replay: boolean;
  transaction: boolean;
};

const defaultFirstEvents = {
  error: null,
  profile: false,
  replay: false,
  transaction: false,
};

const recordAnalyticsFirstEvent = ({
  key,
  organization,
  project,
}: {
  key: 'first_event_recieved' | 'first_transaction_recieved' | 'first_replay_recieved';
  organization: Organization;
  project: Project;
}) =>
  analytics(`onboarding_v2.${key}`, {
    org_id: parseInt(organization.id, 10),
    project: String(project.id),
  });

/**
 * When no event has been received this will be set to null or false.
 * Otherwise it will be the Group of the issue that was received.
 * Or in the case of transactions & replay the value will be set to true.
 * The `group.id` value is used to generate links directly into the event.
 */
type FirstEvent = null | boolean | Group;

type EventWaiterState = {
  firstIssue: FirstEvent;
  firstPoll: boolean;
  firstProfile: FirstEvent;
  firstReplay: FirstEvent;
  firstTransaction: FirstEvent;
};

export interface EventWaiterProps {
  api: Client;
  children: (props: EventWaiterState) => React.ReactNode;
  eventTypes: EventType[];
  organization: Organization;
  project: Project;
  disabled?: boolean;
  onIssueReceived?: (props: {firstIssue: FirstEvent}) => void;
  onProfileReceived?: (props: {firstProfile: FirstEvent}) => void;
  onReplayReceived?: (props: {firstReplay: FirstEvent}) => void;
  onTransactionReceived?: (props: {firstTransaction: FirstEvent}) => void;
  pollInterval?: number;
}

function getFirstEvents(eventTypes: EventType[], resp: Project) {
  const firstEvents: FirstEvents = defaultFirstEvents;

  for (const eventType of eventTypes) {
    if (eventType === 'error') {
      firstEvents.error = resp.firstEvent;
      continue;
    }
    if (eventType === 'transaction') {
      firstEvents.transaction = resp.firstTransactionEvent;
      continue;
    }
    if (eventType === 'replay') {
      firstEvents.replay = resp.hasReplays;
      continue;
    }
    if (eventType === 'profile') {
      firstEvents.profile = resp.hasProfiles;
      continue;
    }
  }

  return firstEvents;
}

/**
 * This is a render prop component that can be used to wait for the first event
 * of a project to be received via polling.
 */
class EventWaiter extends Component<EventWaiterProps, EventWaiterState> {
  state: EventWaiterState = {
    firstIssue: null,
    firstTransaction: null,
    firstReplay: null,
    firstProfile: null,
    firstPoll: true,
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
    const {
      api,
      organization,
      project,
      onIssueReceived,
      onTransactionReceived,
      onReplayReceived,
      onProfileReceived,
    } = this.props;
    let firstEvents: FirstEvents = defaultFirstEvents;
    const newState = {...this.state};
    const eventTypes = [...new Set(this.props.eventTypes)];

    try {
      const resp = await api.requestPromise(
        `/projects/${organization.slug}/${project.slug}/`
      );
      firstEvents = getFirstEvents(eventTypes, resp);

      this.setState(state => ({...state, firstPoll: false}));
    } catch (resp) {
      this.setState(state => ({...state, firstPoll: false}));

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
      Sentry.captureException(
        new Error(`Error polling for first ${eventTypes.join(', ')} event`)
      );
    }

    if (Object.values(firstEvents).every(event => event === null || event === false)) {
      return;
    }

    if (eventTypes.includes('error')) {
      // Locate the projects first issue group. The project.firstEvent field will
      // *not* include sample events, while just looking at the issues list will.
      // We will wait until the project.firstEvent is set and then locate the
      // event given that event datetime
      const issues: Group[] = await api.requestPromise(
        `/projects/${organization.slug}/${project.slug}/issues/`
      );

      // The event may have expired, default to true
      newState.firstIssue =
        issues.find((issue: Group) => issue.firstSeen === firstEvents.error) || true;

      onIssueReceived?.({firstIssue: newState.firstIssue});

      recordAnalyticsFirstEvent({
        key: 'first_event_recieved',
        organization,
        project,
      });
    }

    if (eventTypes.includes('transaction')) {
      newState.firstTransaction = Boolean(firstEvents.transaction);
      onTransactionReceived?.({firstTransaction: newState.firstTransaction});
      recordAnalyticsFirstEvent({
        key: 'first_transaction_recieved',
        organization,
        project,
      });
    }

    if (eventTypes.includes('replay')) {
      newState.firstReplay = Boolean(firstEvents.replay);
      onReplayReceived?.({firstReplay: newState.firstReplay});
      recordAnalyticsFirstEvent({
        key: 'first_replay_recieved',
        organization,
        project,
      });
    }

    if (eventTypes.includes('profile')) {
      newState.firstProfile = Boolean(firstEvents.profile);
      onProfileReceived?.({firstProfile: newState.firstProfile});
    }

    this.stopPolling();
    this.setState(newState);
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
    return this.props.children(this.state);
  }
}

export default withApi(EventWaiter);
