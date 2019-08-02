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
 * @param {Object} app SentryApp
 */
export function addSentryAppToken(client, app) {
  console.log(client);
  addLoadingMessage();
  const promise = client.requestPromise(`/sentry-apps/${app.slug}/api-tokens/`, {
    method: 'POST',
  });
  promise.then(
    () => clearIndicators(),
    () => addErrorMessage(t(`Unable to create new token`))
  );
  return promise;
}

/**
 * Uninstall a sentry application
 *
 * @param {Object} client ApiClient
 * @param {Object} app SentryApp
 * @param {String} token Token string
 */
export function removeSentryAppToken(client, app, token) {
  addLoadingMessage();
  const promise = client.requestPromise(`/sentry-apps/${app.slug}/api-tokens/${token}/`, {
    method: 'DELETE',
  });
  promise.then(
    () => {
      addSuccessMessage(t(`Token successfully uninstalled.`));
    },
    () => clearIndicators()
  );
  return promise;
}
