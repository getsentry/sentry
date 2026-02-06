import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {fetchOrganizationDetails} from 'sentry/actionCreators/organizations';
import {joinTeamPromise} from 'sentry/actionCreators/teams';
import {t} from 'sentry/locale';
import type {Organization, Team} from 'sentry/types/organization';
import {useMutation} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

interface UseJoinTeamOptions {
  organization: Organization;
  team: Team;
}

/**
 * Hook to join a team with open membership.
 * Reloads projects after successful join.
 */
export function useJoinTeam({organization, team}: UseJoinTeamOptions) {
  const api = useApi({persistInFlight: true});

  return useMutation({
    mutationFn: () => {
      return joinTeamPromise(api, {
        orgId: organization.slug,
        teamId: team.slug,
      });
    },
    onSuccess: () => {
      addSuccessMessage(t('You have joined %s', `#${team.slug}`));
      fetchOrganizationDetails(api, organization.slug, {
        loadProjects: true,
      });
    },
    onError: () => {
      addErrorMessage(t('Unable to join %s', `#${team.slug}`));
    },
  });
}
