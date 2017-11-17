import TeamActions from '../actions/teamActions';

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
  let id = api.uniqueId();
  let endpoint = `/teams/${params.orgId}/${params.teamId}/`;
  TeamActions.update(id, params.teamId, params.data);

  return api.request(endpoint, {
    method: 'PUT',
    data: params.data,
    success: data => {
      TeamActions.updateSuccess(id, params.teamId, data);
      doCallback(options, 'success', data);
    },
    error: error => {
      TeamActions.updateError(id, params.teamId, error);
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
      TeamActions.updateSuccess(id, params.teamId, data);
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
      TeamActions.updateSuccess(id, params.teamId, data);
      doCallback(options, 'success', data);
    },
    error: error => {
      TeamActions.updateError(id, params.teamId, error);
      doCallback(options, 'error', error);
    },
  });
}
