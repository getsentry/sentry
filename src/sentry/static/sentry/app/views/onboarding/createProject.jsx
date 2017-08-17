import React from 'react';
import {browserHistory, Link} from 'react-router';

import ApiMixin from '../../mixins/apiMixin';
import ProjectActions from '../../actions/projectActions';
import {getPlatformName} from './utils';

import OnboardingProject from '../onboarding/project';
import {t} from '../../locale';

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
      getDocsUrl: ({slug, projectSlug, platform}) =>
        `/onboarding/${slug}/${projectSlug}/configure/${platform}`
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
        ProjectActions.createSuccess(data);

        // navigate to new url _now_
        const url = this.props.getDocsUrl({slug, projectSlug: data.slug, platform});
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
    let {slug, teams} = this.context.organization;
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
      <div>
        {!teams.length &&
          <div>
            {t(
              'You cannot create a new project because there are no teams to assign it to.'
            )}
            <Link to={`/organizations/${slug}/teams/new/`} className="btn btn-primary">
              {t('Create a Team')}
            </Link>
          </div>}

        <OnboardingProject {...stepProps} />
      </div>
    );
  }
});

export default CreateProject;
