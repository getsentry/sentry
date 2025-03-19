import {LinkButton} from 'sentry/components/core/button';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useCanCreateProject} from 'sentry/utils/useCanCreateProject';
import useOrganization from 'sentry/utils/useOrganization';
import {makeProjectsPathname} from 'sentry/views/projects/pathname';

export default function CreateProjectButton() {
  const organization = useOrganization();
  const canUserCreateProject = useCanCreateProject();

  return (
    <LinkButton
      priority="primary"
      size="sm"
      disabled={!canUserCreateProject}
      title={
        canUserCreateProject
          ? undefined
          : t('You do not have permission to create projects')
      }
      to={makeProjectsPathname({
        path: '/new/',
        orgSlug: organization.slug,
      })}
      icon={<IconAdd isCircled />}
    >
      {t('Create Project')}
    </LinkButton>
  );
}
