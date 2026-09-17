import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {Client} from 'sentry/api';
import {tct} from 'sentry/locale';
import {TeamStore} from 'sentry/stores/teamStore';
import type {Team} from 'sentry/types/organization';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';

/**
 * Note these are both slugs
 */
type OrgSlug = {orgId: string};
type OrgAndTeamSlug = OrgSlug & {teamId: string};

/**
 * This is the actual internal id, not username or email
 */
type MemberId = {memberId: string};

// Fetch user teams for current org and place them in the team store
export async function fetchUserTeams(api: Client, params: OrgSlug) {
  const teams = await api.requestPromise(
    getApiUrl('/organizations/$organizationIdOrSlug/user-teams/', {
      path: {organizationIdOrSlug: params.orgId},
    })
  );
  TeamStore.loadUserTeams(teams);
}

export function updateTeamSuccess(teamId: OrgAndTeamSlug['teamId'], data: Team) {
  TeamStore.onUpdateSuccess(teamId, data);
}

export async function joinTeamPromise(
  api: Client,
  params: OrgAndTeamSlug & Partial<MemberId>
) {
  const data: Team = await api.requestPromise(
    getApiUrl(
      '/organizations/$organizationIdOrSlug/members/$memberId/teams/$teamIdOrSlug/',
      {
        path: {
          organizationIdOrSlug: params.orgId,
          memberId: params.memberId ?? 'me',
          teamIdOrSlug: params.teamId,
        },
      }
    ),
    {
      method: 'POST',
    }
  );

  TeamStore.onUpdateSuccess(params.teamId, data);

  return data;
}

export async function leaveTeamPromise(
  api: Client,
  params: OrgAndTeamSlug & Partial<MemberId>
) {
  const data: Team = await api.requestPromise(
    getApiUrl(
      '/organizations/$organizationIdOrSlug/members/$memberId/teams/$teamIdOrSlug/',
      {
        path: {
          organizationIdOrSlug: params.orgId,
          memberId: params.memberId ?? 'me',
          teamIdOrSlug: params.teamId,
        },
      }
    ),
    {
      method: 'DELETE',
    }
  );

  TeamStore.onUpdateSuccess(params.teamId, data);

  return data;
}

export function removeTeam(api: Client, params: OrgAndTeamSlug) {
  return api
    .requestPromise(
      getApiUrl('/teams/$organizationIdOrSlug/$teamIdOrSlug/', {
        path: {
          organizationIdOrSlug: params.orgId,
          teamIdOrSlug: params.teamId,
        },
      }),
      {
        method: 'DELETE',
      }
    )
    .then(
      data => {
        TeamStore.onRemoveSuccess(params.teamId);
        addSuccessMessage(
          tct('[team] has been removed from the [organization] organization', {
            team: `#${params.teamId}`,
            organization: params.orgId,
          })
        );
        return data;
      },
      err => {
        addErrorMessage(
          tct('Unable to remove [team] from the [organization] organization', {
            team: `#${params.teamId}`,
            organization: params.orgId,
          })
        );
        throw err;
      }
    );
}
