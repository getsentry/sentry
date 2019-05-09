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
export async function createIncident(api, organization, title, groups) {
  addLoadingMessage(t('Creating new incident...'));

  try {
    const resp = await api.requestPromise(
      `/organizations/${organization.slug}/incidents/`,
      {
        method: 'POST',
        data: {
          title,
          groups,
          dateStarted: new Date(),
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
