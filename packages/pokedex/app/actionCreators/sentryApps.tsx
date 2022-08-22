import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import {SentryApp} from 'sentry/types';

/**
 * Remove a Sentry Application
 *
 * @param {Object} client ApiClient
 * @param {Object} app SentryApp
 */
export function removeSentryApp(client: Client, app: SentryApp): Promise<undefined> {
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
