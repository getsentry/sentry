import PropTypes from 'prop-types';
import React from 'react';

import {analytics} from 'app/utils/analytics';
import SentryTypes from 'app/sentryTypes';
import withApi from 'app/utils/withApi';

const DEFAULT_POLL_INTERVAL = 5000;

const recordAnalyticsFirstEvent = ({organization, project}) =>
  analytics('onboarding_v2.first_event_recieved', {
    org_id: parseInt(organization.id, 10),
    project: parseInt(project.id, 10),
  });

/**
 * This is a render prop component that can be used to wait for the first event
 * of a project to be received via polling.
 *
 * When an event is received the {firstIssue} will be passed to the child.
 * Should no issue object be available (the first issue has expired) then it
 * will simply be boolean true.
 *
 * Otherwise this value will be null before the event is received.
 */
class EventWaiter extends React.Component {
  static propTypes = {
    api: PropTypes.object,
    organization: SentryTypes.Organization,
    project: SentryTypes.Project,
    disabled: PropTypes.bool,
    children: PropTypes.func,
    pollInterval: PropTypes.number,
  };

  static defaultProps = {
    pollInterval: DEFAULT_POLL_INTERVAL,
  };

  state = {
    firstIssue: null,
  };

  componentDidMount() {
    this.pollHandler();
    this.startPolling();
  }

  componentDidUpdate(prevProps) {
    this.stopPolling();
    this.startPolling();
  }

  componentWillUnmount() {
    this.stopPolling();
  }

  intervalId = null;

  pollHandler = async () => {
    const {api, organization, project} = this.props;

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
    const issues = await api.requestPromise(
      `/projects/${organization.slug}/${project.slug}/issues/`
    );

    // The event may have expired, default to true
    const firstIssue = issues.find(issue => issue.firstSeen === firstEvent) || true;

    recordAnalyticsFirstEvent({organization, project});

    this.stopPolling();
    this.setState({firstIssue});
  };

  startPolling() {
    const {disabled, organization, project} = this.props;

    if (disabled || !organization || !project || this.state.firstIssue) {
      return;
    }

    this.intervalId = setInterval(this.pollHandler, this.props.pollInterval);
  }

  stopPolling() {
    clearInterval(this.intervalId);
  }

  render() {
    return this.props.children({firstIssue: this.state.firstIssue});
  }
}

export default withApi(EventWaiter);
