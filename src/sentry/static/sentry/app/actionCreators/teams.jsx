import TeamActions from '../actions/teamActions';
import {tct} from '../locale';
import {addSuccessMessage, addErrorMessage} from './indicator';

const doCallback = (params = {}, name, ...args) => {
  if (typeof params[name] === 'function') {
    params[name](...args);
  }
};

// Fetch teams for org
export function fetchTeams(api, params, options) {
  TeamActions.fetchAll(params.orgId);
  return api.request(`/teams/${params.orgId}/`, {
    success: data => {
      TeamActions.fetchAllSuccess(params.orgId, data);
      doCallback(options, 'success', data);
    },
    error: error => {
      TeamActions.fetchAllError(params.orgId, error);
      doCallback(options, 'error', error);
    },
  });
}

export function fetchTeamDetails(api, params, options) {
  TeamActions.fetchDetails(params.teamId);
  return api.request(`/teams/${params.orgId}/${params.teamId}/`, {
    success: data => {
      TeamActions.fetchDetailsSuccess(params.teamId, data);
      doCallback(options, 'success', data);
    },
    error: error => {
      TeamActions.fetchDetailsError(params.teamId, error);
      doCallback(options, 'error', error);
    },
  });
}

export function updateTeam(api, params, options) {
  let endpoint = `/teams/${params.orgId}/${params.teamId}/`;
  TeamActions.update(params.teamId, params.data);

  return api.request(endpoint, {
    method: 'PUT',
    data: params.data,
    success: data => {
      TeamActions.updateSuccess(params.teamId, data);
      doCallback(options, 'success', data);
    },
    error: error => {
      TeamActions.updateError(params.teamId, error);
      doCallback(options, 'error', error);
    },
  });
}

export function joinTeam(api, params, options) {
  let endpoint = `/organizations/${params.orgId}/members/${params.memberId ||
    'me'}/teams/${params.teamId}/`;
  let id = api.uniqueId();

  TeamActions.update(id, params.teamId);

  return api.request(endpoint, {
    method: 'POST',
    data: params.data,
    success: data => {
      TeamActions.updateSuccess(params.teamId, data);
      doCallback(options, 'success', data);
    },
    error: error => {
      TeamActions.updateError(id, params.teamId, error);
      doCallback(options, 'error', error);
    },
  });
}

export function leaveTeam(api, params, options) {
  let endpoint = `/organizations/${params.orgId}/members/${params.memberId ||
    'me'}/teams/${params.teamId}/`;
  let id = api.uniqueId();

  TeamActions.update(id, params.teamId);

  return api.request(endpoint, {
    method: 'DELETE',
    success: data => {
      TeamActions.updateSuccess(params.teamId, data);
      doCallback(options, 'success', data);
    },
    error: error => {
      TeamActions.updateError(id, params.teamId, error);
      doCallback(options, 'error', error);
    },
  });
}

export function removeTeam(api, params, options) {
  TeamActions.removeTeam(params.teamId);

  return api
    .requestPromise(`/teams/${params.orgId}/${params.teamId}/`, {
      method: 'DELETE',
    })
    .then(
      data => {
        TeamActions.removeTeamSuccess(params.teamId, data);
        addSuccessMessage(
          tct('[team] has been removed from [organization]', {
            team: `#${params.teamId}`,
            organization: params.orgId,
          })
        );
        return data;
      },
      err => {
        TeamActions.removeTeamError(params.teamId, err);
        addErrorMessage(
          tct('Unable to remove [team] from [organization]', {
            team: `#${params.teamId}`,
            organization: params.orgId,
          })
        );
        throw err;
      }
    );
}
