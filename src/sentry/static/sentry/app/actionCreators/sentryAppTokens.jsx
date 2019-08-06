import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'app/actionCreators/indicator';
import {t} from 'app/locale';

/**
 * Install a sentry application
 *
 * @param {Object} client ApiClient
 * @param {Object} app SentryApp
 */
export async function addSentryAppToken(client, app) {
  addLoadingMessage();
  try {
    const resp = await client.requestPromise(`/sentry-apps/${app.slug}/api-tokens/`, {
      method: 'POST',
    });
    addSuccessMessage(t('Token successfully added.'));
    return resp;
  } catch (err) {
    addErrorMessage(t('Unable to create token'));
    return err;
  }
}

/**
 * Uninstall a sentry application
 *
 * @param {Object} client ApiClient
 * @param {Object} app SentryApp
 * @param {String} token Token string
 */
export async function removeSentryAppToken(client, app, token) {
  addLoadingMessage();
  try {
    const resp = await client.requestPromise(
      `/sentry-apps/${app.slug}/api-tokens/${token}/`,
      {
        method: 'DELETE',
      }
    );
    addSuccessMessage(t('Token successfully deleted.'));
    return resp;
  } catch (err) {
    addErrorMessage(t('Unable to delete token'));
    return err;
  }
}
