import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {fetchOrganizationDetails} from 'sentry/actionCreators/organizations';
import {joinTeamPromise, leaveTeamPromise} from 'sentry/actionCreators/teams';
import {t} from 'sentry/locale';
import TeamStore from 'sentry/stores/teamStore';
import type {Organization, Team} from 'sentry/types/organization';
import {useMutation} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

interface UseTeamMembershipOptions {
  organization: Organization;
  team: Team;
}

/**
 * Hook to join a team with open membership.
 * Reloads projects after successful join.
 */
export function useJoinTeam({organization, team}: UseTeamMembershipOptions) {
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

/**
 * Hook to request access to a team with closed membership.
 * Updates TeamStore with isPending: true after successful request.
 */
export function useRequestTeamAccess({organization, team}: UseTeamMembershipOptions) {
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
      TeamStore.onUpdateSuccess(team.slug, {
        ...team,
        isPending: true,
      });
    },
    onError: () => {
      addErrorMessage(t('Unable to request access to %s', `#${team.slug}`));
    },
  });
}

/**
 * Hook to leave a team.
 * Reloads projects after successful leave.
 */
export function useLeaveTeam({organization, team}: UseTeamMembershipOptions) {
  const api = useApi({persistInFlight: true});

  return useMutation({
    mutationFn: () => {
      return leaveTeamPromise(api, {
        orgId: organization.slug,
        teamId: team.slug,
      });
    },
    onSuccess: () => {
      addSuccessMessage(t('You have left %s', `#${team.slug}`));
      fetchOrganizationDetails(api, organization.slug, {
        loadProjects: true,
      });
    },
    onError: () => {
      addErrorMessage(t('Unable to leave %s', `#${team.slug}`));
    },
  });
}
