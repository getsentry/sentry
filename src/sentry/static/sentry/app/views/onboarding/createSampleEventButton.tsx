import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import * as Sentry from '@sentry/react';

import {Client} from 'app/api';
import {Organization, Project} from 'app/types';
import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import {trackAdhocEvent, trackAnalyticsEvent} from 'app/utils/analytics';
import Button from 'app/components/button';
import SentryTypes from 'app/sentryTypes';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';

type Props = React.ComponentProps<typeof Button> & {
  api: Client;
  organization: Organization;
  project?: Project;
  source: string;
};

type State = {
  creating: boolean;
};

const EVENT_POLL_RETRIES = 6;
const EVENT_POLL_INTERVAL = 800;

async function latestEventAvailable(
  api: Client,
  groupID: string
): Promise<{eventCreated: boolean; retries: number}> {
  let retries = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (retries > EVENT_POLL_RETRIES) {
      return {eventCreated: false, retries: retries - 1};
    }
    await new Promise(resolve => setTimeout(resolve, EVENT_POLL_INTERVAL));
    try {
      await api.requestPromise(`/issues/${groupID}/events/latest/`);
      return {eventCreated: true, retries};
    } catch {
      ++retries;
    }
  }
}

class CreateSampleEventButton extends React.Component<Props, State> {
  static propTypes: any = {
    api: PropTypes.object,
    organization: SentryTypes.Organization.isRequired,
    project: SentryTypes.Project,
    source: PropTypes.string.isRequired,
    disabled: PropTypes.bool,
  };

  state = {
    creating: false,
  };

  componentDidMount() {
    const {organization, project, source} = this.props;

    if (!project) {
      return;
    }

    trackAdhocEvent({
      eventKey: 'sample_event.button_viewed',
      org_id: organization.id,
      project_id: project.id,
      source,
    });
  }

  recordAnalytics({eventCreated, retries, duration}) {
    const {organization, project, source} = this.props;

    if (!project) {
      return;
    }

    const eventKey = `sample_event.${eventCreated ? 'created' : 'failed'}`;
    const eventName = `Sample Event ${eventCreated ? 'Created' : 'Failed'}`;

    trackAnalyticsEvent({
      eventKey,
      eventName,
      organization_id: organization.id,
      project_id: project.id,
      platform: project.platform || '',
      interval: EVENT_POLL_INTERVAL,
      retries,
      duration,
      source,
    });
  }

  createSampleGroup = async () => {
    // TODO(dena): swap out for action creator
    const {api, organization, project} = this.props;
    let eventData;

    if (!project) {
      return;
    }

    addLoadingMessage(t('Processing sample event...'));
    this.setState({creating: true});

    try {
      const url = `/projects/${organization.slug}/${project.slug}/create-sample/`;
      eventData = await api.requestPromise(url, {method: 'POST'});
    } catch (error) {
      Sentry.withScope(scope => {
        scope.setExtra('error', error);
        Sentry.captureException(new Error('Failed to create sample event'));
      });
      this.setState({creating: false});
      addErrorMessage(t('Failed to create a new sample event'));
      return;
    }

    // Wait for the event to be fully processed and available on the group
    // before redirecting.
    const t0 = performance.now();
    const {eventCreated, retries} = await latestEventAvailable(api, eventData.groupID);
    const t1 = performance.now();

    clearIndicators();
    this.setState({creating: false});

    const duration = Math.ceil(t1 - t0);
    this.recordAnalytics({eventCreated, retries, duration});

    if (!eventCreated) {
      addErrorMessage(t('Failed to load sample event'));

      Sentry.withScope(scope => {
        scope.setTag('groupID', eventData.groupID);
        scope.setTag('platform', project.platform || '');
        scope.setTag('interval', EVENT_POLL_INTERVAL.toString());
        scope.setTag('retries', retries.toString());
        scope.setTag('duration', duration.toString());

        scope.setLevel(Sentry.Severity.Warning);
        Sentry.captureMessage('Failed to load sample event');
      });
      return;
    }

    browserHistory.push(
      `/organizations/${organization.slug}/issues/${eventData.groupID}/`
    );
  };

  render() {
    const {
      api: _api,
      organization: _organization,
      project: _project,
      source: _source,
      ...props
    } = this.props;
    const {creating} = this.state;

    return (
      <Button
        {...props}
        data-test-id="create-sample-event"
        disabled={props.disabled || creating}
        onClick={this.createSampleGroup}
      />
    );
  }
}

export default withApi(withOrganization(CreateSampleEventButton));
