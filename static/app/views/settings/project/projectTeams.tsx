import {RouteComponentProps} from 'react-router';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {openCreateTeamModal} from 'sentry/actionCreators/modal';
import {addTeamToProject, removeTeamFromProject} from 'sentry/actionCreators/projects';
import Link from 'sentry/components/links/link';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import TeamStore from 'sentry/stores/teamStore';
import {space} from 'sentry/styles/space';
import {Organization, Project, Team} from 'sentry/types';
import routeTitleGen from 'sentry/utils/routeTitle';
import AsyncView from 'sentry/views/asyncView';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TeamSelect from 'sentry/views/settings/components/teamSelect';

type Props = {
  organization: Organization;
  project: Project;
} & RouteComponentProps<{projectId: string}, {}>;

type State = {
  projectTeams: null | Team[];
} & AsyncView['state'];

class ProjectTeams extends AsyncView<Props, State> {
  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {organization, project} = this.props;
    return [['projectTeams', `/projects/${organization.slug}/${project.slug}/teams/`]];
  }

  getTitle() {
    const {projectId} = this.props.params;
    return routeTitleGen(t('Project Teams'), projectId, false);
  }

  canCreateTeam = () => {
    const {organization} = this.props;
    const access = new Set(organization.access);
    return (
      access.has('org:write') && access.has('team:write') && access.has('project:write')
    );
  };

  handleRemove = (teamSlug: Team['slug']) => {
    if (this.state.loading) {
      return;
    }

    const {organization, project} = this.props;

    removeTeamFromProject(this.api, organization.slug, project.slug, teamSlug)
      .then(() => this.handleRemovedTeam(teamSlug))
      .catch(() => {
        addErrorMessage(t('Could not remove the %s team', teamSlug));
        this.setState({loading: false});
      });
  };

  handleRemovedTeam = (teamSlug: Team['slug']) => {
    this.setState(prevState => ({
      projectTeams: [
        ...(prevState.projectTeams || []).filter(team => team.slug !== teamSlug),
      ],
    }));
  };

  handleAddedTeam = (team: Team) => {
    this.setState(prevState => ({
      projectTeams: [...(prevState.projectTeams || []), team],
    }));
  };

  handleAdd = (teamSlug: string) => {
    if (this.state.loading) {
      return;
    }

    const team = TeamStore.getBySlug(teamSlug);
    if (!team) {
      addErrorMessage(tct('Unable to find "[teamSlug]"', {teamSlug}));
      this.setState({error: true});
      return;
    }

    const {organization, project} = this.props;

    addTeamToProject(this.api, organization.slug, project.slug, team).then(
      () => {
        this.handleAddedTeam(team);
      },
      () => {
        this.setState({
          error: true,
          loading: false,
        });
      }
    );
  };

  handleCreateTeam = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const {project, organization} = this.props;

    if (!this.canCreateTeam()) {
      return;
    }

    openCreateTeamModal({
      project,
      organization,
      onClose: data => {
        addTeamToProject(this.api, organization.slug, project.slug, data).then(
          this.remountComponent,
          this.remountComponent
        );
      },
    });
  };

  renderBody() {
    const {project, organization} = this.props;

    const canCreateTeam = this.canCreateTeam();
    const hasAccess = organization.access.includes('project:write');
    const confirmRemove = t(
      'This is the last team with access to this project. Removing it will mean only organization owners and managers will be able to access the project pages. Are you sure you want to remove this team from the project %s?',
      project.slug
    );
    const {projectTeams} = this.state;

    const menuHeader = (
      <StyledTeamsLabel>
        {t('Teams')}
        <Tooltip
          disabled={canCreateTeam}
          title={t('You must be a project admin to create teams')}
          position="top"
        >
          <StyledCreateTeamLink
            to="#create-team"
            disabled={!canCreateTeam}
            onClick={this.handleCreateTeam}
          >
            {t('Create Team')}
          </StyledCreateTeamLink>
        </Tooltip>
      </StyledTeamsLabel>
    );

    return (
      <div>
        <SettingsPageHeader title={t('Project Teams for %s', project.slug)} />
        <TeamSelect
          disabled={!hasAccess}
          enforceIdpProvisioned={false}
          organization={organization}
          menuHeader={menuHeader}
          selectedTeams={projectTeams ?? []}
          onAddTeam={this.handleAdd}
          onRemoveTeam={this.handleRemove}
          confirmLastTeamRemoveMessage={confirmRemove}
        />
      </div>
    );
  }
}

const StyledTeamsLabel = styled('div')`
  font-size: 0.875em;
  padding: ${space(0.5)} 0px;
  text-transform: uppercase;
`;

const StyledCreateTeamLink = styled(Link)`
  float: right;
  text-transform: none;
  ${p =>
    p.disabled &&
    css`
      cursor: not-allowed;
      color: ${p.theme.gray300};
      opacity: 0.6;
    `};
`;

export default ProjectTeams;
