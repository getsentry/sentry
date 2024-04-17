import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {t, tct} from 'sentry/locale';
import type {Integration, Repository} from 'sentry/types/integrations';

const api = new Client();

/**
 * Removes an integration from a project.
 *
 * @param orgSlug Organization Slug
 * @param projectId Project Slug
 * @param integration The organization integration to remove
 */
export function removeIntegrationFromProject(
  orgSlug: string,
  projectId: string,
  integration: Integration
) {
  const endpoint = `/projects/${orgSlug}/${projectId}/integrations/${integration.id}/`;
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
 * @param orgSlug Organization Slug
 * @param projectId Project Slug
 * @param integration The organization integration to add
 */
export function addIntegrationToProject(
  orgSlug: string,
  projectId: string,
  integration: Integration
) {
  const endpoint = `/projects/${orgSlug}/${projectId}/integrations/${integration.id}/`;
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
 * @param client ApiClient
 * @param orgSlug Organization Slug
 * @param repositoryId Repository ID
 */
export function deleteRepository(client: Client, orgSlug: string, repositoryId: string) {
  addLoadingMessage();
  const promise = client.requestPromise(
    `/organizations/${orgSlug}/repos/${repositoryId}/`,
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
 * @param client ApiClient
 * @param orgSlug Organization Slug
 * @param repositoryId Repository ID
 */
export function cancelDeleteRepository(
  client: Client,
  orgSlug: string,
  repositoryId: string
) {
  addLoadingMessage();
  const promise = client.requestPromise(
    `/organizations/${orgSlug}/repos/${repositoryId}/`,
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

/**
 * Delete a repository by setting its status to hidden.
 *
 * @param client ApiClient
 * @param orgSlug Organization Slug
 * @param repositoryId Repository ID
 */
export function hideRepository(client: Client, orgSlug: string, repositoryId: string) {
  addLoadingMessage();
  const promise = client.requestPromise(
    `/organizations/${orgSlug}/repos/${repositoryId}/`,
    {
      method: 'PUT',
      data: {status: 'hidden'},
    }
  );
  promise.then(
    () => clearIndicators(),
    () => addErrorMessage(t('Unable to delete repository.'))
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
 * @param client ApiClient
 * @param orgSlug Organization Slug
 * @param repositoryId Repository ID
 * @param integration Integration provider data.
 */
export function migrateRepository(
  client: Client,
  orgSlug: string,
  repositoryId: string,
  integration: Integration
): Promise<Repository> {
  const data = {integrationId: integration.id};
  addLoadingMessage();
  const promise = client.requestPromise(
    `/organizations/${orgSlug}/repos/${repositoryId}/`,
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
 * @param client ApiClient
 * @param orgSlug Organization Slug
 * @param name Repository identifier/name to add
 * @param integration Integration provider data.
 */
export function addRepository(
  client: Client,
  orgSlug: string,
  name: string,
  integration: Integration
): Promise<Repository> {
  const data = {
    installation: integration.id,
    identifier: name,
    provider: `integrations:${integration.provider.key}`,
  };
  addLoadingMessage();
  const promise = client.requestPromise(`/organizations/${orgSlug}/repos/`, {
    method: 'POST',
    data,
  });
  return applyRepositoryAddComplete(promise);
}
