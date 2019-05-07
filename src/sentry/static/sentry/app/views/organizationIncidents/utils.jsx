export function fetchIncident(api, orgId, incidentId) {
  return api.requestPromise(`/organizations/${orgId}/incidents/${incidentId}/`);
}

export function updateSubscription(api, orgId, incidentId, isSubscribed) {
  return api.requestPromise(`/organizations/${orgId}/incidents/${incidentId}/`, {
    method: 'PUT',
    data: {
      isSubscribed,
    },
  });
}

export function getStatus(status) {
  switch (status) {
    case 1:
      return 'created';
    case 2:
      return 'closed';
    case 0:
    default:
      return 'detected';
  }
}
