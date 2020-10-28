import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import {SentryApp, InternalAppApiToken} from 'app/types';
import {Client} from 'app/api';

/**
 * Install a sentry application
 *
 * @param {Object} client ApiClient
 * @param {Object} app SentryApp
 */
export async function addSentryAppToken(
  client: Client,
  app: SentryApp
): Promise<InternalAppApiToken> {
  addLoadingMessage();
  try {
    const token = await client.requestPromise(`/sentry-apps/${app.slug}/api-tokens/`, {
      method: 'POST',
    });
    addSuccessMessage(t('Token successfully added.'));
    return token;
  } catch (err) {
    addErrorMessage(t('Unable to create token'));
    throw err;
  }
}

/**
 * Uninstall a sentry application
 *
 * @param {Object} client ApiClient
 * @param {Object} app SentryApp
 * @param {String} token Token string
 */
export async function removeSentryAppToken(
  client: Client,
  app: SentryApp,
  token: string
): Promise<void> {
  addLoadingMessage();
  try {
    await client.requestPromise(`/sentry-apps/${app.slug}/api-tokens/${token}/`, {
      method: 'DELETE',
    });
    addSuccessMessage(t('Token successfully deleted.'));
    return;
  } catch (err) {
    addErrorMessage(t('Unable to delete token'));
    throw err;
  }
}
