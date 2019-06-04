export const INCIDENT_STATUS = {
  DETECTED: 0,
  CREATED: 1,
  CLOSED: 2,
};

export const INCIDENT_ACTIVITY_TYPE = {
  CREATED: 0,
  DETECTED: 1,
  STATUS_CHANGE: 2,
  COMMENT: 3,
};

export function fetchIncident(api, orgId, incidentId) {
  return api.requestPromise(`/organizations/${orgId}/incidents/${incidentId}/`);
}

export function updateSubscription(api, orgId, incidentId, isSubscribed) {
  const method = isSubscribed ? 'POST' : 'DELETE';
  return api.requestPromise(
    `/organizations/${orgId}/incidents/${incidentId}/subscriptions/`,
    {
      method,
    }
  );
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
