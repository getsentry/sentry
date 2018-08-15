import React from 'react';
import createReactClass from 'create-react-class';
import {browserHistory} from 'react-router';

import sdk from 'app/utils/sdk';
import analytics from 'app/utils/analytics';
import ApiMixin from 'app/mixins/apiMixin';
import HookOrDefault from 'app/components/hookOrDefault';
import HookStore from 'app/stores/hookStore';
import LoadingIndicator from 'app/components/loadingIndicator';
import ProjectContext from 'app/views/projects/projectContext';
import ProjectDocsContext from 'app/views/projectInstall/docsContext';
import ProjectInstallPlatform from 'app/views/projectInstall/platform';
import SentryTypes from 'app/sentryTypes';
import Waiting from 'app/views/onboarding/configure/waiting';

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
      loading: true,
      WaitingComponent: null,
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

  componentDidMount() {
    this.getWaitingComponent();
    this.logExperiment();
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

  getWaitingComponent() {
    let WaitingComponent = HookOrDefault({
      hookName: 'experiment:sample-event',
      defaultComponent: Waiting,
    });
    this.setState({WaitingComponent, loading: false});
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
        sdk.captureMessage('Polling for events in onboarding configure failed', {
          extra: err,
        });
      },
    });
  },

  logExperiment() {
    let {organization} = this.context;
    if (!organization.experiments) return;

    let exposed = organization.experiments.SampleEventExperiment;

    if (exposed === 0 || exposed === 1) {
      let data = {
        experiment_name: 'SampleEventExperiment',
        unit_name: 'org_id',
        unit_id: parseInt(organization.id, 10),
        params: `{exposed: ${exposed}}`,
      };

      HookStore.get('analytics:log-experiment').forEach(cb => cb(data));
    }
  },

  createSampleEvent() {
    let {orgId, projectId} = this.props.params;
    let url = `/projects/${orgId}/${projectId}/create-sample/`;

    analytics('sample_event.created', {
      org_id: parseInt(orgId, 10),
      project_id: projectId,
      source: 'installation',
    });

    this.api.request(url, {
      method: 'POST',
      success: data => {
        browserHistory.push(`/${orgId}/${projectId}/issues/${data.groupID}/`);
      },
      error: err => {
        sdk.captureMessage('Create sample event in onboarding configure step failed', {
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

    if (this.state.loading) return <LoadingIndicator />;
    let {WaitingComponent} = this.state;

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
          <WaitingComponent
            skip={this.submit}
            hasEvent={this.state.hasSentRealEvent}
            params={this.props.params}
          />
        </div>
      </div>
    );
  },
});

export default Configure;
