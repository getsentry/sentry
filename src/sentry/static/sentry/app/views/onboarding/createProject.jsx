import PropTypes from 'prop-types';
import Raven from 'raven-js';
import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';
import styled from 'react-emotion';

import {Panel} from '../../components/panels';
import {getPlatformName} from './utils';
import {openCreateTeamModal} from '../../actionCreators/modal';
import {t} from '../../locale';
import ApiMixin from '../../mixins/apiMixin';
import Button from '../../components/buttons/button';
import OnboardingProject from '../onboarding/project';
import OrganizationState from '../../mixins/organizationState';
import PanelAlert from '../../components/panels/panelAlert';
import ProjectActions from '../../actions/projectActions';
import TeamActions from '../../actions/teamActions';
import space from '../../styles/space';

const CreateProject = createReactClass({
  displayName: 'CreateProject',

  propTypes: {
    getDocsUrl: PropTypes.func,
  },

  contextTypes: {
    router: PropTypes.object,
    location: PropTypes.object,
  },

  mixins: [
    ApiMixin,
    OrganizationState,
    Reflux.listenTo(TeamActions.createTeamSuccess, 'onTeamCreated'),
  ],

  getDefaultProps() {
    return {
      getDocsUrl: ({slug, projectSlug, platform}) =>
        `/onboarding/${slug}/${projectSlug}/configure/${platform}`,
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
      inFlight: false,
    };
  },

  onTeamCreated() {
    let {router} = this.context;

    // After team gets created we need to force OrganizationContext to basically remount
    router.replace({
      pathname: router.location.pathname,
      state: 'refresh',
    });
  },

  createProject() {
    let {router} = this.context;
    let {slug} = this.getOrganization();
    let {projectName, platform, team, inFlight} = this.state;

    //prevent double-trigger
    if (inFlight) return;
    this.setState({inFlight: true});

    if (!projectName) {
      Raven.captureMessage('Onboarding no project name ', {
        extra: {props: this.props, state: this.state},
      });
    }

    this.api.request(`/teams/${slug}/${team}/projects/`, {
      method: 'POST',
      data: {
        name: projectName,
        platform,
      },
      success: data => {
        ProjectActions.createSuccess(data);

        // navigate to new url _now_
        const url = this.props.getDocsUrl({slug, projectSlug: data.slug, platform});
        this.setState({inFlight: false});
        router.push(url);
      },
      error: err => {
        this.setState({
          inFlight: false,
          error: err.responseJSON.detail,
        });

        if (err.status != 403) {
          Raven.captureMessage('Onboarding project creation failed', {
            extra: {
              err,
              props: this.props,
              state: this.state,
            },
          });
        }
      },
    });
  },

  render() {
    let {projectName, platform, error} = this.state;
    let organization = this.getOrganization();
    let {teams} = organization;
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
      setTeam: teamSlug => this.setState({team: teamSlug}),
    };

    return (
      <div>
        {error && <h2 className="alert alert-error">{error}</h2>}
        {accessTeams.length ? (
          <OnboardingProject {...stepProps} />
        ) : (
          <Panel
            title={t('Cannot Create Project')}
            body={
              <React.Fragment>
                <PanelAlert type="error">
                  {t(
                    'You cannot create a new project because there are no teams to assign it to.'
                  )}
                </PanelAlert>
                <CreateTeamBody>
                  <Button
                    priority="primary"
                    onClick={() =>
                      openCreateTeamModal({
                        organization,
                      })}
                  >
                    {t('Create a Team')}
                  </Button>
                </CreateTeamBody>
              </React.Fragment>
            }
          />
        )}
      </div>
    );
  },
});

export default CreateProject;

const CreateTeamBody = styled('div')`
  display: flex;
  justify-content: center;
  padding: ${space(2)};
`;
