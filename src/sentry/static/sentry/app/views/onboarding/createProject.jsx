import PropTypes from 'prop-types';
import Raven from 'raven-js';
import React from 'react';
import {browserHistory, Link} from 'react-router';

import ApiMixin from '../../mixins/apiMixin';
import OrganizationState from '../../mixins/organizationState';
import ProjectActions from '../../actions/projectActions';

import {getPlatformName} from './utils';
import OnboardingProject from '../onboarding/project';

import {t} from '../../locale';

const CreateProject = React.createClass({
  propTypes: {
    getDocsUrl: PropTypes.func
  },

  contextTypes: {
    location: PropTypes.object
  },

  mixins: [ApiMixin, OrganizationState],

  getDefaultProps() {
    return {
      getDocsUrl: ({slug, projectSlug, platform}) =>
        `/onboarding/${slug}/${projectSlug}/configure/${platform}`
    };
  },

  getInitialState() {
    let {teams} = this.getOrganization();
    let accessTeams = teams.filter(team => team.hasAccess);
    let {query} = this.context.location;

    let team = query.team || (accessTeams.length && accessTeams[0].slug);
    let platform = getPlatformName(query.platform) ? query.platform : '';

    return {
      loading: true,
      error: false,
      projectName: getPlatformName(platform) || '',
      team,
      platform,
      inFlight: false
    };
  },

  createProject() {
    let {slug} = this.getOrganization();
    let {projectName, platform, team, inFlight} = this.state;

    //prevent double-trigger
    if (inFlight) return;
    this.setState({inFlight: true});

    if (!projectName) {
      Raven.captureMessage('Onboarding no project name ', {
        extra: {props: this.props, state: this.state}
      });
    }

    this.api.request(`/teams/${slug}/${team}/projects/`, {
      method: 'POST',
      data: {
        name: projectName,
        platform
      },
      success: data => {
        ProjectActions.createSuccess(data);

        // navigate to new url _now_
        const url = this.props.getDocsUrl({slug, projectSlug: data.slug, platform});
        this.setState({inFlight: false});
        browserHistory.push(url);
      },
      error: err => {
        this.setState({
          inFlight: false,
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

  render() {
    let {projectName, platform, error} = this.state;
    let {slug, teams} = this.getOrganization();
    let accessTeams = teams.filter(team => team.hasAccess);

    const stepProps = {
      next: this.createProject,
      platform,
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
