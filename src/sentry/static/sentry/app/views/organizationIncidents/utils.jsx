export const INCIDENT_STATUS = {
  DETECTED: 0,
  CREATED: 1,
  CLOSED: 2,
};

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

export function updateStatus(api, orgId, incidentId, status) {
  return api.requestPromise(`/organizations/${orgId}/incidents/${incidentId}/`, {
    method: 'PUT',
    data: {
      status,
    },
  });
}

/**
 * Is incident open?
 *
 * @param {Object} incident Incident object
 * @returns {Boolean}
 */

export function isOpen(incident) {
  switch (incident.status) {
    case INCIDENT_STATUS.CLOSED:
      return false;
    case INCIDENT_STATUS.DETECTED:
    case INCIDENT_STATUS.CREATED:
    default:
      return true;
  }
}
