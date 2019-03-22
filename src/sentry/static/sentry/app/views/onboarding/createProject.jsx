import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';
import styled from 'react-emotion';
import * as Sentry from '@sentry/browser';

import {Panel} from 'app/components/panels';
import {getPlatformName} from 'app/views/onboarding/utils';
import {openCreateTeamModal} from 'app/actionCreators/modal';
import {t} from 'app/locale';
import ApiMixin from 'app/mixins/apiMixin';
import Button from 'app/components/button';
import HookStore from 'app/stores/hookStore';
import OnboardingProject from 'app/views/onboarding/project';
import OrganizationState from 'app/mixins/organizationState';
import PanelAlert from 'app/components/panels/panelAlert';
import ProjectActions from 'app/actions/projectActions';
import TeamActions from 'app/actions/teamActions';
import space from 'app/styles/space';

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
    const {teams} = this.getOrganization();
    const accessTeams = teams.filter(team => team.hasAccess);
    const {query} = this.context.location;

    const team = query.team || (accessTeams.length && accessTeams[0].slug);
    const platform = getPlatformName(query.platform) ? query.platform : '';

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
    const {router} = this.context;
    // After team gets created we need to force OrganizationContext to basically remount
    router.replace({
      pathname: router.location.pathname,
      state: 'refresh',
    });
  },

  navigateNextUrl(data) {
    const organization = this.getOrganization();

    const url =
      HookStore.get('utils:onboarding-survey-url').length &&
      organization.projects.length === 0
        ? HookStore.get('utils:onboarding-survey-url')[0](data, organization)
        : data.docsUrl;

    this.setState({inFlight: false});
    data.router.push(url);
  },

  createProject() {
    const {router} = this.context;
    const {slug} = this.getOrganization();
    const {projectName, platform, team, inFlight} = this.state;

    //prevent double-trigger
    if (inFlight) {
      return;
    }
    this.setState({inFlight: true});

    if (!projectName) {
      Sentry.withScope(scope => {
        scope.setExtra('props', this.props);
        scope.setExtra('state', this.state);
        Sentry.captureMessage('Onboarding no project name');
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
        const docsUrl = this.props.getDocsUrl({slug, projectSlug: data.slug, platform});
        this.navigateNextUrl({router, slug, projectSlug: data.slug, platform, docsUrl});
      },
      error: err => {
        this.setState({
          inFlight: false,
          error: err.responseJSON.detail,
        });

        // Only log this if the error is something other than:
        // * The user not having access to create a project, or,
        // * A project with that slug already exists
        if (err.status !== 403 && err.status !== 409) {
          Sentry.withScope(scope => {
            scope.setExtra('err', err);
            scope.setExtra('props', this.props);
            scope.setExtra('state', this.state);
            Sentry.captureMessage('Onboarding project creation failed');
          });
        }
      },
    });
  },

  render() {
    const {projectName, platform, error} = this.state;
    const organization = this.getOrganization();
    const {teams} = organization;
    const accessTeams = teams.filter(team => team.hasAccess);

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
                    className="ref-create-team"
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
