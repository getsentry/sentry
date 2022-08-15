import {Client} from 'sentry/api';
import {t, tct} from 'sentry/locale';
import {Organization, SentryFunction} from 'sentry/types';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
  clearIndicators,
} from './indicator';

export async function removeSentryFunction(
  client: Client,
  org: Organization,
  sentryFn: SentryFunction
) {
  addLoadingMessage();
  try {
    await client.requestPromise(
      `/organizations/${org.slug}/functions/${sentryFn.slug}/`,
      {
        method: 'DELETE',
      }
    );
    addSuccessMessage(tct('[name] successfully deleted.', {name: sentryFn.name}));
    return true;
  } catch (err) {
    clearIndicators();
    addErrorMessage(err?.responseJSON?.detail || t('Unknown Error'));
    return false;
  }
}
