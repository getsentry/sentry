import {useMutation} from '@tanstack/react-query';

import {toast} from '@sentry/scraps/toast';

import {fetchOrganizationDetails} from 'sentry/actionCreators/organizations';
import {leaveTeamPromise} from 'sentry/actionCreators/teams';
import {t} from 'sentry/locale';
import type {Organization, Team} from 'sentry/types/organization';
import {useApi} from 'sentry/utils/useApi';
interface UseLeaveTeamOptions {
  organization: Organization;
  team: Team;
}

/**
 * Hook to leave a team.
 * Reloads projects after successful leave.
 */
export function useLeaveTeam({organization, team}: UseLeaveTeamOptions) {
  const api = useApi({persistInFlight: true});

  return useMutation({
    mutationFn: () => {
      return leaveTeamPromise(api, {
        orgId: organization.slug,
        teamId: team.slug,
      });
    },
    onSuccess: () => {
      toast.success(t('You have left %s', `#${team.slug}`));
      fetchOrganizationDetails(api, organization.slug, {
        loadProjects: true,
      });
    },
    onError: () => {
      toast.error(t('Unable to leave %s', `#${team.slug}`));
    },
  });
}
