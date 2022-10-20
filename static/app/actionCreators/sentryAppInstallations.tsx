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
    () => addErrorMessage(t('Unable to install %s', app.name))
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
  const capitalizedAppSlug =
    install.app.slug.charAt(0).toUpperCase() + install.app.slug.slice(1);
  promise.then(
    () => {
      addSuccessMessage(t('%s successfully uninstalled.', capitalizedAppSlug));
    },
    () => clearIndicators()
  );
  return promise;
}
