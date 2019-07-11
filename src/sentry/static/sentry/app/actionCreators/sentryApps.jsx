import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
  clearIndicators,
} from 'app/actionCreators/indicator';
import {t} from 'app/locale';

/**
 * Remove a Sentry Application
 *
 * @param {Object} client ApiClient
 * @param {Object} app SentryApp
 */
export function removeSentryApp(client, app) {
  addLoadingMessage();
  const promise = client.requestPromise(`/sentry-apps/${app.slug}/`, {
    method: 'DELETE',
  });
  promise.then(
    () => {
      addSuccessMessage(t('%s successfully removed.', app.slug));
    },
    () => {
      clearIndicators();
      addErrorMessage(t('Unable to remove %s integration', app.slug));
    }
  );
  return promise;
}

/**
 * Request a Sentry Application to be published
 *
 * @param {Object} client ApiClient
 * @param {Object} app SentryApp
 */
export async function publishRequestSentryApp(client, app) {
  addLoadingMessage();
  try {
    await client.requestPromise(`/sentry-apps/${app.slug}/publish-request/`, {
      method: 'POST',
    });
    addSuccessMessage(t('Request to publish %s successful.', app.slug));
  } catch (err) {
    clearIndicators();
    addErrorMessage(t('Request to publish %s fails.', app.slug));
    throw err;
  }
}
