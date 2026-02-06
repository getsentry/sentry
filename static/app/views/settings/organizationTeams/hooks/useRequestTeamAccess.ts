import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {joinTeamPromise} from 'sentry/actionCreators/teams';
import {t} from 'sentry/locale';
import type {Organization, Team} from 'sentry/types/organization';
import {useMutation} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

interface UseRequestTeamAccessOptions {
  organization: Organization;
  team: Team;
}

/**
 * Hook to request access to a team with closed membership.
 * Updates TeamStore with isPending: true after successful request.
 */
export function useRequestTeamAccess({organization, team}: UseRequestTeamAccessOptions) {
  const api = useApi({persistInFlight: true});

  return useMutation({
    mutationFn: () => {
      return joinTeamPromise(api, {
        orgId: organization.slug,
        teamId: team.slug,
      });
    },
    onSuccess: () => {
      addSuccessMessage(t('You have requested access to %s', `#${team.slug}`));
    },
    onError: () => {
      addErrorMessage(t('Unable to request access to %s', `#${team.slug}`));
    },
  });
}
