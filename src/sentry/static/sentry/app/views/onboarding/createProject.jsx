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
    organization: React.PropTypes.object,
    location: React.PropTypes.object
  },

  mixins: [ApiMixin],

  getDefaultProps() {
    return {
      getDocsUrl: ({slug, projectSlug, platform}) =>
        `/onboarding/${slug}/${projectSlug}/configure/${platform}`
    };
  },

  getInitialState() {
    let {teams} = this.context.organization;
    let accessTeams = teams.filter(team => team.hasAccess);

    let team =
      this.context.location.query.team || (accessTeams.length && accessTeams[0].slug);
    return {
      loading: true,
      error: false,
      platform: '',
      projectName: '',
      team: team
    };
  },

  createProject() {
    let {slug} = this.context.organization;
    let {projectName, platform, team} = this.state;

    if (!projectName) {
      Raven.captureMessage('Onboarding no project name ', {
        extra: {props: this.props, state: this.state}
      });
    }

    this.api.request(`/teams/${slug}/${team}/projects/`, {
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
        this.setState({
          loading: false,
          error: err.responseJSON.detail
        });

        if (err.status != 403) {
          Raven.captureMessage('Onboarding project creation failed', {
            extra: {
              err,
              props: this.props,
              state: this.state
            }
          });
        }
      }
    });
  },

  next() {
    this.createProject();
  },

  render() {
    let {projectName, platform, error} = this.state;
    let {slug, teams} = this.context.organization;
    let accessTeams = teams.filter(team => team.hasAccess);

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
      setName: n => this.setState({projectName: n}),
      team: this.state.team,
      teams: accessTeams,
      setTeam: teamSlug => this.setState({team: teamSlug})
    };
    return (
      <div>
        {error && <h2 className="alert alert-error">{error}</h2>}
        {accessTeams.length
          ? <OnboardingProject {...stepProps} />
          : <div>
              <h4>
                {t(
                  'You cannot create a new project because there are no teams to assign it to.'
                )}
              </h4>
              <Link to={`/organizations/${slug}/teams/new/`} className="btn btn-primary">
                {t('Create a Team')}
              </Link>
            </div>}
      </div>
    );
  }
});

export default CreateProject;
