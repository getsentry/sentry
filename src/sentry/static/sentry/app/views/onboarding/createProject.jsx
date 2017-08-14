import React from 'react';
import {browserHistory} from 'react-router';

import ApiMixin from '../../mixins/apiMixin';
import ProjectActions from '../../actions/projectActions';
import {getPlatformName} from './utils';

import OnboardingProject from '../onboarding/project';

import Raven from 'raven-js';

const CreateProject = React.createClass({
  propTypes: {
    getDocsUrl: React.PropTypes.func
  },

  contextTypes: {
    organization: React.PropTypes.object
  },

  mixins: [ApiMixin],

  getDefaultProps() {
    return {
      getDocsUrl: ({orgSlug, project, teamSlug}) => {
        // let org = this.context.organization;]
        let path = `/onboarding/${orgSlug}/${project.slug}/configure/${this.state.platform}`;
        return path;
      }
    };
  },

  getInitialState() {
    return {
      loading: true,
      error: false,
      platform: '',
      projectName: ''
    };
  },

  createProject() {
    let {teams, slug} = this.context.organization;
    let {projectName, platform} = this.state;

    if (!projectName) {
      Raven.captureMessage('Onboarding no project name ', {
        extra: {props: this.props, state: this.state}
      });
    }

    this.api.request(`/teams/${slug}/${teams[0].slug}/projects/`, {
      method: 'POST',
      data: {
        name: projectName,
        platform: platform
      },
      success: data => {
        data = {
          ...data,
          orgSlug: slug,
          teamId: teams[0].slug
        };
        //TODO ENSURE THIS IS WELL FORMED FOR WHATEVER THIS THING WANTS
        ProjectActions.createSuccess(data);

        // navigate to new url _now_
        const url = this.props.getDocsUrl(data);
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

    return <OnboardingProject {...stepProps} />;
  }
});

export default CreateProject;
