import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'app/actionCreators/indicator';
import {t} from 'app/locale';

/**
 * Creates a new incident
 *
 * @param {Object} api API Client
 * @param {Object} organization Organization object
 * @param {String} title Title of the incident
 * @param {String[]} groups List of group ids
 */
export async function createIncident(
  api,
  organization,
  title,
  groups,
  dateStarted = new Date()
) {
  addLoadingMessage(t('Creating new incident...'));

  try {
    const resp = await api.requestPromise(
      `/organizations/${organization.slug}/incidents/`,
      {
        method: 'POST',
        data: {
          title,
          groups,
          dateStarted,
          query: '',
        },
      }
    );
    clearIndicators();
    return resp;
  } catch (err) {
    addErrorMessage(t('Unable to create incident'));
    throw err;
  }
}

/**
 * Fetches a list of activities for an incident
 */
export async function fetchIncidentActivities(api, orgId, incidentId) {}

/**
 * Creates a note for an incident
 */
export async function createIncidentNote(api, incidentId, note) {
  addLoadingMessage(t('Posting comment...'));

  try {
    // TODO: Implement me

    clearIndicators();
  } catch (err) {
    addErrorMessage(t('Unable to post comment'));
    throw err;
  }
}

/**
 * Deletes a note for an incident
 */
export async function deleteIncidentNote(api, incidentId, item) {
  addLoadingMessage(t('Removing comment...'));

  try {
    // TODO: Implement me

    clearIndicators();
  } catch (err) {
    addErrorMessage(t('Failed to delete comment'));
    throw err;
  }
}

/**
 * Updates a note for an incident
 */
export async function updateIncidentNote(api, incidentId, item, note) {
  addLoadingMessage(t('Updating comment...'));

  try {
    // TODO: Implement me
    clearIndicators();
  } catch (err) {
    addErrorMessage(t('Unable to update comment'));
    throw err;
  }
}
