import {RouteComponentProps} from 'react-router';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {openCreateTeamModal} from 'sentry/actionCreators/modal';
import {addTeamToProject, removeTeamFromProject} from 'sentry/actionCreators/projects';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {t, tct} from 'sentry/locale';
import TeamStore from 'sentry/stores/teamStore';
import {Organization, Project, Team} from 'sentry/types';
import routeTitleGen from 'sentry/utils/routeTitle';
import DeprecatedAsyncView from 'sentry/views/deprecatedAsyncView';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TeamSelectForProject from 'sentry/views/settings/components/teamSelect/teamSelectForProject';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import PermissionAlert from 'sentry/views/settings/project/permissionAlert';

type Props = {
  organization: Organization;
  project: Project;
} & RouteComponentProps<{projectId: string}, {}>;

type State = {
  projectTeams: null | Team[];
} & DeprecatedAsyncView['state'];

class ProjectTeams extends DeprecatedAsyncView<Props, State> {
  getEndpoints(): ReturnType<DeprecatedAsyncView['getEndpoints']> {
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
    const {projectTeams} = this.state;

    const canCreateTeam = this.canCreateTeam();
    const hasWriteAccess = hasEveryAccess(['project:write'], {organization, project});

    return (
      <div>
        <SettingsPageHeader title={t('Project Teams for %s', project.slug)} />
        <TextBlock>
          {t(
            'These teams and their members have access to this project. They can be assigned to issues and alerts created in it.'
          )}
        </TextBlock>
        <TextBlock>
          {t(
            'Team Admins can grant other teams access to this project. However, they cannot revoke access unless they are admins for the other teams too.'
          )}
        </TextBlock>
        <PermissionAlert project={project} />

        <TeamSelectForProject
          disabled={!hasWriteAccess}
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
        />
      </div>
    );
  }
}

export default ProjectTeams;
