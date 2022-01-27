import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import {SentryApp, SentryAppInstallation} from 'sentry/types';

/**
 * Install a sentry application
 *
 * @param {Object} client ApiClient
 * @param {String} orgId Organization Slug
 * @param {Object} app SentryApp
 */
export function installSentryApp(
  client: Client,
  orgId: string,
  app: SentryApp
): Promise<SentryAppInstallation> {
  addLoadingMessage();
  const promise = client.requestPromise(
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
export function uninstallSentryApp(
  client: Client,
  install: SentryAppInstallation
): Promise<void> {
  addLoadingMessage();
  const promise = client.requestPromise(`/sentry-app-installations/${install.uuid}/`, {
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
