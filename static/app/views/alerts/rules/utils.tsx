import IdBadge from 'sentry/components/idBadge';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';

export function getProjectOptions({
  organization,
  projects,
  isFormDisabled,
}: {
  isFormDisabled: boolean;
  organization: Organization;
  projects: Project[];
}) {
  const hasOrgAlertWrite = organization.access.includes('alerts:write');
  const hasOrgWrite = organization.access.includes('org:write');
  const hasOpenMembership = organization.features.includes('open-membership');

  // If form is enabled, we want to limit to the subset of projects which the
  // user can create/edit alerts.
  const projectWithWrite =
    isFormDisabled || hasOrgAlertWrite
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
