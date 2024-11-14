import {LinkButton} from 'sentry/components/button';
import {canCreateProject} from 'sentry/components/projects/canCreateProject';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

export default function CreateProjectButton() {
  const organization = useOrganization();
  const canUserCreateProject = canCreateProject(organization);

  return (
    <LinkButton
      priority="primary"
      size="sm"
      disabled={!canUserCreateProject}
      title={
        !canUserCreateProject
          ? t('You do not have permission to create projects')
          : undefined
      }
      to={`/organizations/${organization.slug}/projects/new/`}
      icon={<IconAdd isCircled />}
    >
      {t('Create Project')}
    </LinkButton>
  );
}
