import {t} from 'app/locale';
import IndicatorStore from 'app/stores/indicatorStore';
import {Client} from 'app/api';

const api = new Client();

/**
 *  Removes an integration from a project.
 *
 * @param {String} orgId Organization Slug
 * @param {String} projectId Project Slug
 * @param {Object} integration The organization integration to remove
 */
export function removeIntegrationFromProject(orgId, projectId, integration) {
  const endpoint = `/projects/${orgId}/${projectId}/integrations/${integration.id}/`;
  const saveIndicator = IndicatorStore.add(
    t('Disabling %s for %s', integration.name, projectId)
  );

  return api.requestPromise(endpoint, {method: 'DELETE'}).then(
    () => {
      IndicatorStore.addSuccess(t('Disabled %s for %s', integration.name, projectId));
      IndicatorStore.remove(saveIndicator);
    },
    err => {
      IndicatorStore.addError(
        t('Failed to disable %s for %s', integration.name, projectId)
      );
      IndicatorStore.remove(saveIndicator);
    }
  );
}

/**
 *  Add an integration to a project
 *
 * @param {String} orgId Organization Slug
 * @param {String} projectId Project Slug
 * @param {Object} integration The organization integration to add
 */
export function addIntegrationToProject(orgId, projectId, integration) {
  const endpoint = `/projects/${orgId}/${projectId}/integrations/${integration.id}/`;
  const saveIndicator = IndicatorStore.add(
    t('Adding %s to %s', integration.name, projectId)
  );

  return api.requestPromise(endpoint, {method: 'PUT'}).then(
    () => {
      IndicatorStore.addSuccess(t('Enabled %s for %s', integration.name, projectId));
      IndicatorStore.remove(saveIndicator);
    },
    err => {
      IndicatorStore.addError(
        t('Failed to enabled %s for %s', integration.name, projectId)
      );
      IndicatorStore.remove(saveIndicator);
    }
  );
}
