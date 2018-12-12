import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
  clearIndicators,
} from 'app/actionCreators/indicator';
import {t} from 'app/locale';

/**
 * Install a sentry application
 *
 * @param {Object} client ApiClient
 * @param {String} orgId Organization Slug
 * @param {Object} app SentryApp
 */
export function installSentryApp(client, orgId, app) {
  addLoadingMessage();
  let promise = client.requestPromise(
    `/organizations/${orgId}/sentry-app-installations/`,
    {
      method: 'POST',
      data: {slug: app.slug},
    }
  );
  promise.then(
    () => clearIndicators(),
    () => addErrorMessage(t(`Unable to install ${app.name}`))
  );
  return promise;
}

/**
 * Uninstall a sentry application
 *
 * @param {Object} client ApiClient
 * @param {Object} install SentryAppInstallation
 */
export function uninstallSentryApp(client, install) {
  addLoadingMessage();
  let promise = client.requestPromise(`/sentry-app-installations/${install.uuid}/`, {
    method: 'DELETE',
  });
  promise.then(
    () => {
      addSuccessMessage(t(`${install.app.slug} successfully uninstalled.`));
    },
    () => clearIndicators()
  );
  return promise;
}
