import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {
  useAddTeamToProject,
  useFetchProjectTeams,
  useRemoveTeamFromProject,
} from 'sentry/actionCreators/projects';
import {hasEveryAccess} from 'sentry/components/acl/access';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import TeamStore from 'sentry/stores/teamStore';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import routeTitleGen from 'sentry/utils/routeTitle';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TeamSelectForProject from 'sentry/views/settings/components/teamSelect/teamSelectForProject';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';

type ProjectTeamsProps = {
  organization: Organization;
  project: Project;
};

export function ProjectTeams({organization, project}: ProjectTeamsProps) {
  const {
    data: projectTeams,
    isPending,
    isError,
  } = useFetchProjectTeams({orgSlug: organization.slug, projectSlug: project.slug});
  const handleAddTeamToProject = useAddTeamToProject({
    orgSlug: organization.slug,
    projectSlug: project.slug,
  });
  const handleRemoveTeamFromProject = useRemoveTeamFromProject({
    orgSlug: organization.slug,
    projectSlug: project.slug,
  });

  const canCreateTeam =
    organization.access.includes('org:write') &&
    organization.access.includes('team:write') &&
    organization.access.includes('project:write');
  const hasWriteAccess = hasEveryAccess(['project:write'], {organization, project});

  if (isError) {
    return <LoadingError message={t('Failed to load project teams')} />;
  }

  if (isPending) {
    return <LoadingIndicator />;
  }

  return (
    <SentryDocumentTitle title={routeTitleGen(t('Project Teams'), project.slug, false)}>
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
        <ProjectPermissionAlert project={project} />

        <TeamSelectForProject
          disabled={!hasWriteAccess}
          canCreateTeam={canCreateTeam}
          organization={organization}
          project={project}
          selectedTeams={projectTeams ?? []}
          onAddTeam={teamSlug => {
            const team = TeamStore.getBySlug(teamSlug);

            if (!team) {
              addErrorMessage(tct('Unable to find "[teamSlug]"', {teamSlug}));
              return;
            }

            handleAddTeamToProject(team);
          }}
          onRemoveTeam={handleRemoveTeamFromProject}
          onCreateTeam={handleAddTeamToProject}
        />
      </div>
    </SentryDocumentTitle>
  );
}

export default ProjectTeams;
