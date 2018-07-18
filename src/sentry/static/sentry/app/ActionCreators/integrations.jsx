import {Client} from 'app/api';
import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'app/actionCreators/indicator';
import {t} from 'app/locale';

const api = new Client();

/**
 * Removes an integration from a project.
 *
 * @param {String} orgId Organization Slug
 * @param {String} projectId Project Slug
 * @param {Object} integration The organization integration to remove
 */
export function removeIntegrationFromProject(orgId, projectId, integration) {
  const endpoint = `/projects/${orgId}/${projectId}/integrations/${integration.id}/`;
  addLoadingMessage();

  return api.requestPromise(endpoint, {method: 'DELETE'}).then(
    () => {
      addSuccessMessage(t('Disabled %s for %s', integration.name, projectId));
    },
    err => {
      addErrorMessage(t('Failed to disable %s for %s', integration.name, projectId));
    }
  );
}

/**
 * Add an integration to a project
 *
 * @param {String} orgId Organization Slug
 * @param {String} projectId Project Slug
 * @param {Object} integration The organization integration to add
 */
export function addIntegrationToProject(orgId, projectId, integration) {
  const endpoint = `/projects/${orgId}/${projectId}/integrations/${integration.id}/`;
  addLoadingMessage();

  return api.requestPromise(endpoint, {method: 'PUT'}).then(
    () => {
      addSuccessMessage(t('Enabled %s for %s', integration.name, projectId));
    },
    err => {
      addErrorMessage(t('Failed to enabled %s for %s', integration.name, projectId));
    }
  );
}
