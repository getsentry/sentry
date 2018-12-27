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
  let promise = client.requestPromise(`/sentry-apps/${app.slug}/`, {
    method: 'DELETE',
  });
  promise.then(
    () => {
      addSuccessMessage(t(`${app.slug} successfully removed.`));
    },
    () => {
      clearIndicators();
      addErrorMessage(t(`Unable to remove ${app.slug} application`));
    }
  );
  return promise;
}
