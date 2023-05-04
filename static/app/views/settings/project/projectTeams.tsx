import {RouteComponentProps} from 'react-router';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {openCreateTeamModal} from 'sentry/actionCreators/modal';
import {addTeamToProject, removeTeamFromProject} from 'sentry/actionCreators/projects';
import {t, tct} from 'sentry/locale';
import TeamStore from 'sentry/stores/teamStore';
import {Organization, Project, Team} from 'sentry/types';
import routeTitleGen from 'sentry/utils/routeTitle';
import AsyncView from 'sentry/views/asyncView';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TeamSelectForProject from 'sentry/views/settings/components/teamSelect/teamSelectForProject';

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
    const access = this.props.organization.access;
    return (
      access.includes('org:write') &&
      access.includes('team:write') &&
      access.includes('project:write')
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

    return (
      <div>
        <SettingsPageHeader title={t('Project Teams for %s', project.slug)} />
        <TeamSelectForProject
          disabled={!hasAccess}
          canCreateTeam={canCreateTeam}
          organization={organization}
          project={project}
          selectedTeams={projectTeams ?? []}
          onAddTeam={this.handleAdd}
          onRemoveTeam={this.handleRemove}
          onCreateTeam={(team: Team) => {
            addTeamToProject(this.api, organization.slug, project.slug, team).then(
              this.remountComponent,
              this.remountComponent
            );
          }}
          confirmLastTeamRemoveMessage={confirmRemove}
        />
      </div>
    );
  }
}

export default ProjectTeams;
