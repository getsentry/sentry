import React from 'react';
import DocumentTitle from 'react-document-title';
import {browserHistory} from 'react-router';

import ApiMixin from '../../mixins/apiMixin';
import ProjectActions from '../../actions/projectActions';
import {getPlatformName} from '../onboarding/utils';
import OnboardingProject from '../onboarding/project';

import OrganizationHomeContainer from '../../components/organizations/homeContainer';

import Raven from 'raven-js';

const newProject = React.createClass({
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

  renderStep() {},

  getProjectUrlProps(project) {
    let org = this.context.organization;
    let path = `/onboarding/${org.slug}/${project.slug}/configure/${this.state.platform}`;
    return path;
  },

  createProject() {
    let {orgId} = this.props.params;
    let {teams} = this.context.organization;
    let {projectName, platform} = this.state;

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
        Raven.captureMessage('New project creation failed', {
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
    let {projectName, platform} = this.state;

    const stepProps = {
      next: this.next,
      platform: platform,
      setPlatform: p => {
        if (!projectName || (platform && getPlatformName(platform) === projectName)) {
          this.setState({projectName: getPlatformName(p)});
        }
        this.setState({platform: p});
      },
      name: projectName,
      setName: n => this.setState({projectName: n})
    };

    return (
      <OrganizationHomeContainer>
        <DocumentTitle title={'Sentry'} />
        <h2>Create a New Project:</h2>
        <OnboardingProject {...stepProps} />
      </OrganizationHomeContainer>
    );
  }
});

export default newProject;
