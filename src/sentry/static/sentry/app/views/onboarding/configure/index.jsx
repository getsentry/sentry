import React from 'react';
import createReactClass from 'create-react-class';
import {browserHistory} from 'react-router';
import Raven from 'raven-js';

import analytics from 'app/utils/analytics';
import Waiting from 'app/views/onboarding/configure/waiting';
import ApiMixin from 'app/mixins/apiMixin';
import ProjectContext from 'app/views/projects/projectContext';
import ProjectDocsContext from 'app/views/projectInstall/docsContext';
import ProjectInstallPlatform from 'app/views/projectInstall/platform';
import HookStore from 'app/stores/hookStore';

const Configure = createReactClass({
  displayName: 'Configure',
  mixins: [ApiMixin],

  getInitialState() {
    return {
      isFirstTimePolling: true,
      hasSentRealEvent: false,
    };
  },

  componentWillMount() {
    let {platform} = this.props.params;
    //redirect if platform is not known.
    if (!platform || platform === 'other') {
      this.redirectToNeutralDocs();
    }

    this.fetchEventData();
    this.timer = setInterval(() => {
      this.fetchEventData();
    }, 2000);
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
      let firstError = data[0];
      return !firstError.message.includes('This is an example');
    } else {
      return data.length > 1;
    }
  },

  redirectUrl() {
    let {orgId, projectId} = this.props.params;

    let url = `/${orgId}/${projectId}/#welcome`;
    browserHistory.push(url);
  },

  fetchEventData() {
    let {orgId, projectId} = this.props.params;

    this.api.request(`/projects/${orgId}/${projectId}/events/`, {
      method: 'GET',
      success: data => {
        this.setState({
          isFirstTimePolling: false,
          hasSentRealEvent: this.sentRealEvent(data),
        });
      },

      error: err => {
        Raven.captureMessage('Polling for events in onboarding configure failed', {
          extra: err,
        });
      },
    });
  },

  submit() {
    HookStore.get('analytics:onboarding-complete').forEach(cb => cb());
    analytics('onboarding.complete', {project: this.props.params.projectId});
    this.redirectUrl();
  },

  redirectToNeutralDocs() {
    let {orgId, projectId} = this.props.params;
    let url = `/${orgId}/${projectId}/getting-started`;

    browserHistory.push(url);
  },

  render() {
    let {orgId, projectId} = this.props.params;

    return (
      <div>
        <div className="onboarding-Configure">
          <h2 style={{marginBottom: 30}}>Configure your application</h2>
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
          <Waiting skip={this.submit} hasEvent={this.state.hasSentRealEvent} />
        </div>
      </div>
    );
  },
});

export default Configure;
