import React from 'react';
import DocumentTitle from 'react-document-title';
import {browserHistory} from 'react-router';

import ApiMixin from '../../mixins/apiMixin';
import ProgressNodes from './progress';
import ProjectActions from '../../actions/projectActions';
import {getPlatformName} from './utils';

import Raven from 'raven-js';

const OnboardingWizard = React.createClass({
  contextTypes: {
    organization: React.PropTypes.object
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: true,
      error: false,
      platform: '',
      projectName: ''
    };
  },

  renderStep() {
    const stepProps = {
      next: this.next,
      platform: this.state.platform,
      setPlatform: p => {
        if (
          !this.state.projectName ||
          getPlatformName(this.state.platform) === this.state.projectName
        ) {
          this.setState({projectName: getPlatformName(p)});
        }
        this.setState({platform: p});
      },
      name: this.state.projectName,
      setName: n => this.setState({projectName: n})
    };

    return React.cloneElement(this.props.children, stepProps);
  },

  getProjectUrlProps(project) {
    let org = this.context.organization;
    let path = `/onboarding/${org.slug}/${project.slug}/configure/${this.state.platform}`;
    return path;
  },

  createProject() {
    let {orgId} = this.props.params;
    let {teams} = this.context.organization;
    let {projectName, platform} = this.state;

    if (!projectName) {
      Raven.captureMessage('Onboarding no project name ', {
        extra: {props: this.props, state: this.state}
      });
    }

    this.api.request(`/teams/${orgId}/${teams[0].slug}/projects/`, {
      method: 'POST',
      data: {
        name: projectName,
        platform: platform
      },
      success: data => {
        data = {
          ...data,
          orgId: orgId,
          teamId: orgId
        };

        ProjectActions.createSuccess(data);

        // navigate to new url _now_
        const url = this.getProjectUrlProps(data);
        browserHistory.push(url);
      },
      error: err => {
        Raven.captureMessage('Onboarding project creation failed', {
          extra: {
            err,
            props: this.props,
            state: this.state
          }
        });

        this.setState({
          loading: false,
          error: true
        });
      }
    });
  },

  next() {
    this.createProject();
  },

  render() {
    return (
      <div className="onboarding-container">
        <DocumentTitle title={'Sentry'} />
        <div className="step-container">
          <ProgressNodes params={this.props.params} />
          <div>
            <this.renderStep />
          </div>
        </div>
      </div>
    );
  }
});

export default OnboardingWizard;
