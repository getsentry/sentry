import {canCreateProject} from 'sentry/components/projects/canCreateProject';
import useOrganization from 'sentry/utils/useOrganization';
import {useUserTeams} from 'sentry/utils/useUserTeams';

export function useCanCreateProject() {
  const organization = useOrganization();
  const {teams} = useUserTeams();

  return canCreateProject(organization, teams);
}
