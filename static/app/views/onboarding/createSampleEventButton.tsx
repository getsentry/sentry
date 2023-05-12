import {Component} from 'react';
import {browserHistory} from 'react-router';
import * as Sentry from '@sentry/react';

import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {Button, ButtonProps} from 'sentry/components/button';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import withApi from 'sentry/utils/withApi';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import withOrganization from 'sentry/utils/withOrganization';

type CreateSampleEventButtonProps = ButtonProps & {
  api: Client;
  organization: Organization;
  source: string;
  onClick?: () => void;
  onCreateSampleGroup?: () => void;
  project?: Project;
};

type State = {
  creating: boolean;
};

const EVENT_POLL_RETRIES = 30;
const EVENT_POLL_INTERVAL = 1000;

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

    await new Promise(resolve => window.setTimeout(resolve, EVENT_POLL_INTERVAL));

    try {
      await api.requestPromise(`/issues/${groupID}/events/latest/`);
      return {eventCreated: true, retries};
    } catch {
      ++retries;
    }
  }
}

class CreateSampleEventButton extends Component<CreateSampleEventButtonProps, State> {
  state: State = {
    creating: false,
  };

  componentDidMount() {
    const {organization, project, source} = this.props;

    if (!project) {
      return;
    }

    trackAnalytics('sample_event.button_viewed', {
      organization,
      project_id: project.id,
      source,
    });
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  private _isMounted = true;

  recordAnalytics({eventCreated, retries, duration}) {
    const {organization, project, source} = this.props;

    if (!project) {
      return;
    }

    const eventKey = `sample_event.${eventCreated ? 'created' : 'failed'}` as const;

    trackAnalytics(eventKey, {
      organization,
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
    const {api, organization, project, onCreateSampleGroup} = this.props;
    let eventData;

    if (!project) {
      return;
    }

    if (onCreateSampleGroup) {
      onCreateSampleGroup();
    } else {
      trackAnalytics('growth.onboarding_view_sample_event', {
        platform: project.platform,
        organization,
      });
    }

    addLoadingMessage(t('Processing sample event...'), {
      duration: EVENT_POLL_RETRIES * EVENT_POLL_INTERVAL,
    });
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
      clearIndicators();
      addErrorMessage(t('Failed to create a new sample event'));
      return;
    }

    // Wait for the event to be fully processed and available on the group
    // before redirecting.
    const t0 = performance.now();
    const {eventCreated, retries} = await latestEventAvailable(api, eventData.groupID);

    // Navigated away before event was created - skip analytics and error messages
    // latestEventAvailable will succeed even if the request was cancelled
    if (!this._isMounted) {
      return;
    }

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

        scope.setLevel('warning');
        Sentry.captureMessage('Failed to load sample event');
      });
      return;
    }

    this.props.onClick?.();

    browserHistory.push(
      normalizeUrl(
        `/organizations/${organization.slug}/issues/${eventData.groupID}/?project=${project.id}&referrer=sample-error`
      )
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
        disabled={props.disabled || creating}
        onClick={this.createSampleGroup}
      />
    );
  }
}

export default withApi(withOrganization(CreateSampleEventButton));
