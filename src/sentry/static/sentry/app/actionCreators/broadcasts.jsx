export function getAll(api) {
  return api.requestPromise('/broadcasts/', {method: 'GET'});
}

export function markAsSeen(api, idList) {
  return api.requestPromise('/broadcasts/', {
    method: 'PUT',
    query: {id: idList},
    data: {hasSeen: '1'},
  });
}
