import React from 'react';

import {analytics} from 'app/utils/analytics';
import {Client} from 'app/api';
import {Organization, Project, Group} from 'app/types';
import withApi from 'app/utils/withApi';

const DEFAULT_POLL_INTERVAL = 5000;

const recordAnalyticsFirstEvent = ({organization, project}) =>
  analytics('onboarding_v2.first_event_recieved', {
    org_id: parseInt(organization.id, 10),
    project: parseInt(project.id, 10),
  });

/**
 * Should no issue object be available (the first issue has expired) then it
 * will simply be boolean true. When no event has been recieved this will be
 * null. Otherwise it will be the group
 */
type FirstIssue = null | true | Group;

type Props = {
  api: Client;
  organization: Organization;
  project: Project;
  disabled?: boolean;
  pollInterval?: number;
  onIssueRecieved?: (props: {firstIssue: FirstIssue}) => void;
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
    const {api, organization, project, onIssueRecieved} = this.props;

    const {firstEvent} = await api.requestPromise(
      `/projects/${organization.slug}/${project.slug}/`
    );

    if (firstEvent === null) {
      return;
    }

    // Locate the projects first issue group. The project.firstEvent field will
    // *not* include sample events, while just looking at the issues list will.
    // We will wait until the project.firstEvent is set and then locate the
    // event given that event datetime
    const issues: Group[] = await api.requestPromise(
      `/projects/${organization.slug}/${project.slug}/issues/`
    );

    // The event may have expired, default to true
    const firstIssue =
      issues.find((issue: Group) => issue.firstSeen === firstEvent) || true;

    recordAnalyticsFirstEvent({organization, project});

    if (onIssueRecieved) {
      onIssueRecieved({firstIssue});
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
