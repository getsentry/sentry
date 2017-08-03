import GroupActions from '../actions/groupActions';

export function loadSimilarIssues(api, params) {
  GroupActions.loadSimilarIssues();
  let endpoint = `/issues/${params.groupId}/similar/`;
  api.request(endpoint, {
    method: 'GET',
    query: params.query,
    data: params.query,
    success: (data, _, jqXHR) => {
      GroupActions.loadSimilarIssuesSuccess(data, _, jqXHR);
    },
    error: err => {
      GroupActions.loadSimilarIssuesError(err);
    }
  });
}

export function loadMergedEvents(api, params) {
  GroupActions.loadMergedEvents();
  let endpoint = `/issues/${params.groupId}/hashes/`;
  api.request(endpoint, {
    method: 'GET',
    query: params.query,
    data: params.query,
    success: (data, _, jqXHR) => {
      GroupActions.loadMergedEventsSuccess(data, _, jqXHR);
    },
    error: err => {
      GroupActions.loadMergedEventsError(err);
    }
  });
}
