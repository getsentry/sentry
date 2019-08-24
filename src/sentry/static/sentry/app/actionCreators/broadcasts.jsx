export function getAllBroadcasts(api, orgSlug) {
  return api.requestPromise(`/organizations/${orgSlug}/broadcasts/`, {method: 'GET'});
}

export function markBroadcastsAsSeen(api, idList) {
  return api.requestPromise('/broadcasts/', {
    method: 'PUT',
    query: {id: idList},
    data: {hasSeen: '1'},
  });
}
