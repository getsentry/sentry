import {Button} from 'sentry/components/button';
import {useProjectCreationAccess} from 'sentry/components/projects/useProjectCreationAccess';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {useTeams} from 'sentry/utils/useTeams';

export default function CreateProjectButton() {
  const organization = useOrganization();
  const {teams, initiallyLoaded} = useTeams();
  const {canCreateProject} = useProjectCreationAccess({organization, teams});

  return (
    <Button
      priority="primary"
      size="sm"
      disabled={!initiallyLoaded || !canCreateProject}
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
