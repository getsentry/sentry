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

/**
 * Is incident resolved?
 *
 * @param {Object} incident Incident object
 * @returns {Boolean}
 */

export function isResolved(incident) {
  switch (incident.status) {
    case 2: // closed
      return true;
    case 0: // detected
    case 1: // created
    default:
      return false;
  }
}
