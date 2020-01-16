import {Client} from 'app/api';
import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
  clearIndicators,
} from 'app/actionCreators/indicator';
import {t, tct} from 'app/locale';
import {Integration, Repository} from 'app/types';

const api = new Client();

/**
 * Removes an integration from a project.
 *
 * @param {String} orgId Organization Slug
 * @param {String} projectId Project Slug
 * @param {Object} integration The organization integration to remove
 */
export function removeIntegrationFromProject(
  orgId: string,
  projectId: string,
  integration: Integration
) {
  const endpoint = `/projects/${orgId}/${projectId}/integrations/${integration.id}/`;
  addLoadingMessage();

  return api.requestPromise(endpoint, {method: 'DELETE'}).then(
    () => {
      addSuccessMessage(t('Disabled %s for %s', integration.name, projectId));
    },
    () => {
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
export function addIntegrationToProject(
  orgId: string,
  projectId: string,
  integration: Integration
) {
  const endpoint = `/projects/${orgId}/${projectId}/integrations/${integration.id}/`;
  addLoadingMessage();

  return api.requestPromise(endpoint, {method: 'PUT'}).then(
    () => {
      addSuccessMessage(t('Enabled %s for %s', integration.name, projectId));
    },
    () => {
      addErrorMessage(t('Failed to enabled %s for %s', integration.name, projectId));
    }
  );
}

/**
 * Delete a respository
 *
 * @param {Object} client ApiClient
 * @param {String} orgId Organization Slug
 * @param {String} repositoryId Repository ID
 */
export function deleteRepository(client: Client, orgId: string, repositoryId: string) {
  addLoadingMessage();
  const promise = client.requestPromise(
    `/organizations/${orgId}/repos/${repositoryId}/`,
    {
      method: 'DELETE',
    }
  );
  promise.then(
    () => clearIndicators(),
    () => addErrorMessage(t('Unable to delete repository.'))
  );
  return promise;
}

/**
 * Cancel the deletion of a respository
 *
 * @param {Object} client ApiClient
 * @param {String} orgId Organization Slug
 * @param {String} repositoryId Repository ID
 */
export function cancelDeleteRepository(
  client: Client,
  orgId: string,
  repositoryId: string
) {
  addLoadingMessage();
  const promise = client.requestPromise(
    `/organizations/${orgId}/repos/${repositoryId}/`,
    {
      method: 'PUT',
      data: {status: 'visible'},
    }
  );
  promise.then(
    () => clearIndicators(),
    () => addErrorMessage(t('Unable to cancel deletion.'))
  );
  return promise;
}

function applyRepositoryAddComplete(promise: Promise<Repository>) {
  promise.then(
    (repo: Repository) => {
      const message = tct('[repo] has been successfully added.', {
        repo: repo.name,
      });
      addSuccessMessage(message);
    },
    errorData => {
      const text = errorData.responseJSON.errors
        ? errorData.responseJSON.errors.__all__
        : t('Unable to add repository.');
      addErrorMessage(text);
    }
  );
  return promise;
}

/**
 * Migrate a repository to a new integration.
 *
 * @param {Object} client ApiClient
 * @param {String} orgId Organization Slug
 * @param {String} repositoryId Repository ID
 * @param {Object} integration Integration provider data.
 */
export function migrateRepository(
  client: Client,
  orgId: string,
  repositoryId: string,
  integration: Integration
) {
  const data = {integrationId: integration.id};
  addLoadingMessage();
  const promise = client.requestPromise(
    `/organizations/${orgId}/repos/${repositoryId}/`,
    {
      data,
      method: 'PUT',
    }
  );
  return applyRepositoryAddComplete(promise);
}

/**
 * Add a repository
 *
 * @param {Object} client ApiClient
 * @param {String} orgId Organization Slug
 * @param {String} name Repository identifier/name to add
 * @param {Object} integration Integration provider data.
 */
export function addRepository(
  client: Client,
  orgId: string,
  name: string,
  integration: Integration
) {
  const data = {
    installation: integration.id,
    identifier: name,
    provider: `integrations:${integration.provider.key}`,
  };
  addLoadingMessage();
  const promise = client.requestPromise(`/organizations/${orgId}/repos/`, {
    method: 'POST',
    data,
  });
  return applyRepositoryAddComplete(promise);
}
