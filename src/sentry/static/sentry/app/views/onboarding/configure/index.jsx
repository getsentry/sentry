import React from 'react';
import createReactClass from 'create-react-class';
import {browserHistory} from 'react-router';
import * as Sentry from '@sentry/browser';

import {analytics, amplitude} from 'app/utils/analytics';
import ApiMixin from 'app/mixins/apiMixin';
import CreateSampleEvent from 'app/components/createSampleEvent';
import ProjectContext from 'app/views/projects/projectContext';
import ProjectDocsContext from 'app/views/projectInstall/docsContext';
import ProjectInstallPlatform from 'app/views/projectInstall/platform';
import SentryTypes from 'app/sentryTypes';
import Waiting from 'app/views/onboarding/configure/waiting';
import {t} from 'app/locale';

const Configure = createReactClass({
  displayName: 'Configure',
  contextTypes: {
    organization: SentryTypes.Organization,
  },
  mixins: [ApiMixin],

  getInitialState() {
    return {
      isFirstTimePolling: true,
      hasSentRealEvent: false,
    };
  },

  componentWillMount() {
    const {platform} = this.props.params;
    //redirect if platform is not known.
    if (!platform || platform === 'other') {
      this.redirectToNeutralDocs();
    }
    this.fetchEventData();
    this.timer = setInterval(() => {
      this.fetchEventData();
    }, 2000);
  },

  componentDidMount() {
    const {organization} = this.context;
    const {params} = this.props;
    const data = {
      project: params.projectId,
      platform: params.platform,
    };

    amplitude(
      'Viewed Onboarding Installation Instructions',
      parseInt(organization.id, 10),
      data
    );

    data.org_id = parseInt(organization.id, 10);
    analytics('onboarding.configure_viewed', data);
  },

  componentWillUpdate(nextProps, nextState) {
    if (
      !this.state.isFirstTimePolling &&
      nextState.hasSentRealEvent == true &&
      this.state.hasSentRealEvent == false
    ) {
      this.redirectUrl();
    }
  },

  componentWillUnmount() {
    clearInterval(this.timer);
  },

  sentRealEvent(data) {
    if (data.length == 1) {
      const firstError = data[0];
      return !firstError.message.includes('This is an example');
    } else {
      return data.length > 1;
    }
  },

  redirectUrl() {
    const {orgId, projectId} = this.props.params;
    const {organization} = this.context;

    const hasSentry10 = new Set(organization.features).has('sentry10');

    const url = hasSentry10
      ? `/organizations/${orgId}/issues/#welcome`
      : `/${orgId}/${projectId}/#welcome`;
    browserHistory.push(url);
  },

  fetchEventData() {
    const {orgId, projectId} = this.props.params;

    this.api.request(`/projects/${orgId}/${projectId}/events/`, {
      method: 'GET',
      success: data => {
        this.setState({
          isFirstTimePolling: false,
          hasSentRealEvent: this.sentRealEvent(data),
        });
      },

      error: err => {
        Sentry.withScope(scope => {
          scope.setExtra('err', err);
          Sentry.captureMessage('Polling for events in onboarding configure failed');
        });
      },
    });
  },

  submit() {
    const {projectId} = this.props.params;
    const {organization} = this.context;
    analytics('onboarding.complete', {project: projectId});
    amplitude(
      'Completed Onboarding Installation Instructions',
      parseInt(organization.id, 10),
      {projectId}
    );
    this.redirectUrl();
  },

  redirectToNeutralDocs() {
    const {orgId, projectId} = this.props.params;
    const {organization} = this.context;

    const url = new Set(organization.features).has('sentry10')
      ? `/organizations/${orgId}/projects/${projectId}/getting-started/`
      : `/${orgId}/${projectId}/getting-started/`;

    browserHistory.push(url);
  },

  render() {
    const {orgId, projectId} = this.props.params;
    const {hasSentRealEvent} = this.state;

    return (
      <div>
        <div className="onboarding-Configure">
          <h2 style={{marginBottom: 30}}>
            {t('Configure your application')}
            {!hasSentRealEvent && (
              <CreateSampleEvent params={this.props.params} source="header" />
            )}
          </h2>
          <ProjectContext projectId={projectId} orgId={orgId} style={{marginBottom: 30}}>
            <ProjectDocsContext>
              <ProjectInstallPlatform
                platformData={{
                  hack:
                    'actually set by ProjectDocsContext, this object is here to avoid proptypes warnings',
                }}
                params={this.props.params}
                linkPath={(_orgId, _projectId, _platform) =>
                  `/onboarding/${_orgId}/${_projectId}/configure/${_platform}/`}
              />
            </ProjectDocsContext>
          </ProjectContext>
          <Waiting skip={this.submit} hasEvent={hasSentRealEvent} />
        </div>
      </div>
    );
  },
});

export default Configure;
