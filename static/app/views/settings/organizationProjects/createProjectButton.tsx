import {Button} from 'sentry/components/button';
import {canCreateProject} from 'sentry/components/projects/utils';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';

type Props = {
  organization: Organization;
};

export default function CreateProjectButton({organization}: Props) {
  const canCreateProjects = canCreateProject(organization);

  return (
    <Button
      priority="primary"
      size="sm"
      disabled={!canCreateProjects}
      title={
        !canCreateProjects
          ? t('You do not have permission to create projects')
          : undefined
      }
      to={`/organizations/${organization.slug}/projects/new/`}
      icon={<IconAdd size="xs" isCircled />}
    >
      {t('Create Project')}
    </Button>
  );
}
