import IdBadge from 'sentry/components/idBadge';
import {t} from 'sentry/locale';
import {Project} from 'sentry/types';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';

export function getProjectOptions({
  projects,
  isFormDisabled,
  hasOpenMembership,
  hasOrgWrite,
}: {
  hasOpenMembership: boolean;
  hasOrgWrite: boolean;
  isFormDisabled: boolean;
  projects: Project[];
}) {
  // If form is enabled, we want to limit to the subset of projects which the
  // user can create/edit alerts.
  const projectWithWrite = isFormDisabled
    ? projects
    : projects.filter(project => project.access.includes('alerts:write'));
  const myProjects = projectWithWrite.filter(project => project.isMember);
  const allProjects = projectWithWrite.filter(project => !project.isMember);

  const myProjectOptions = myProjects.map(myProject => ({
    value: myProject.id,
    label: myProject.slug,
    leadingItems: renderIdBadge(myProject),
  }));

  const openMembershipProjects = [
    {
      label: t('My Projects'),
      options: myProjectOptions,
    },
    {
      label: t('All Projects'),
      options: allProjects.map(allProject => ({
        value: allProject.id,
        label: allProject.slug,
        leadingItems: renderIdBadge(allProject),
      })),
    },
  ];

  return hasOpenMembership || hasOrgWrite || isActiveSuperuser()
    ? openMembershipProjects
    : myProjectOptions;
}

function renderIdBadge(project: Project) {
  return (
    <IdBadge
      project={project}
      avatarProps={{consistentWidth: true}}
      avatarSize={18}
      disableLink
      hideName
    />
  );
}
