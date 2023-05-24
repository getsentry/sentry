import {Button} from 'sentry/components/button';
import {useProjectCreationAccess} from 'sentry/components/projects/useProjectCreationAccess';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';

type Props = {
  organization: Organization;
};

export default function CreateProjectButton({organization}: Props) {
  const {canCreateProject} = useProjectCreationAccess(organization);

  return (
    <Button
      priority="primary"
      size="sm"
      disabled={!canCreateProject}
      title={
        !canCreateProject ? t('You do not have permission to create projects') : undefined
      }
      to={`/organizations/${organization.slug}/projects/new/`}
      icon={<IconAdd size="xs" isCircled />}
    >
      {t('Create Project')}
    </Button>
  );
}
