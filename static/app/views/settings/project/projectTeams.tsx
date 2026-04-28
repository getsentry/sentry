import {useQuery} from '@tanstack/react-query';

import {Stack} from '@sentry/scraps/layout';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {
  projectTeamsApiOptions,
  useAddTeamToProject,
  useRemoveTeamFromProject,
} from 'sentry/actionCreators/projects';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import type {CursorHandler} from 'sentry/components/pagination';
import {Pagination} from 'sentry/components/pagination';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {TeamStore} from 'sentry/stores/teamStore';
import {selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {decodeScalar} from 'sentry/utils/queryString';
import {routeTitleGen} from 'sentry/utils/routeTitle';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {TeamSelect as TeamSelectForProject} from 'sentry/views/settings/components/teamSelect/teamSelectForProject';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

export default function ProjectTeams() {
  const navigate = useNavigate();
  const location = useLocation();
  const organization = useOrganization();
  const {project} = useProjectSettingsOutlet();

  const {data, isPending, isError} = useQuery({
    ...projectTeamsApiOptions({
      orgSlug: organization.slug,
      projectSlug: project.slug,
      cursor: decodeScalar(location.query.cursor),
    }),
    select: selectJsonWithHeaders,
  });
  const projectTeams = data?.json;

  const handleAddTeamToProject = useAddTeamToProject({
    orgSlug: organization.slug,
    projectSlug: project.slug,
    cursor: decodeScalar(location.query.cursor),
  });

  const handleRemoveTeamFromProject = useRemoveTeamFromProject({
    orgSlug: organization.slug,
    projectSlug: project.slug,
    cursor: decodeScalar(location.query.cursor),
  });

  const handleCursor: CursorHandler = resultsCursor => {
    navigate({
      query: {...location.query, cursor: resultsCursor},
    });
  };

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
        <SettingsPageHeader
          title={t('Project Teams for %s', project.slug)}
          subtitle={
            <Stack gap="md">
              <div>
                {t(
                  'These teams and their members have access to this project. They can be assigned to issues and alerts created in it.'
                )}
              </div>
              <div>
                {t(
                  'Team Admins can grant other teams access to this project. However, they cannot revoke access unless they are admins for the other teams too.'
                )}
              </div>
            </Stack>
          }
        />
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
        <Pagination pageLinks={data?.headers.Link} onCursor={handleCursor} />
      </div>
    </SentryDocumentTitle>
  );
}
