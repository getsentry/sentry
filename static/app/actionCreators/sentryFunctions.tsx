import {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import {Organization, SentryFunction} from 'sentry/types';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
  clearIndicators,
} from './indicator';

export function removeSentryFunction(
  client: Client,
  org: Organization,
  sentryFn: SentryFunction
): Promise<undefined> {
  addLoadingMessage();
  const promise = client.requestPromise(
    `/organizations/${org.slug}/functions/${sentryFn.slug}/`,
    {
      method: 'DELETE',
    }
  );
  promise.then(
    () => {
      addSuccessMessage(t('%s successfully removed.', sentryFn.name));
    },
    () => {
      clearIndicators();
      addErrorMessage(t('Unable to remove %s function', sentryFn.name));
    }
  );
  return promise;
}
