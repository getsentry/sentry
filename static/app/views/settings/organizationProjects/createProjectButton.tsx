import {LinkButton} from 'sentry/components/button';
import {canCreateProject} from 'sentry/components/projects/canCreateProject';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {useUserTeams} from 'sentry/utils/useUserTeams';

export default function CreateProjectButton() {
  const organization = useOrganization();
  const {teams} = useUserTeams();
  const canUserCreateProject = canCreateProject(organization, teams);

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
