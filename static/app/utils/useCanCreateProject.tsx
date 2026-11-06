import {canCreateProject} from 'sentry/components/projects/canCreateProject';

import {useOrganization} from './useOrganization';
import {useUserTeams} from './useUserTeams';

export function useCanCreateProject() {
  const organization = useOrganization();
  const {teams} = useUserTeams();

  return canCreateProject(organization, teams);
}
