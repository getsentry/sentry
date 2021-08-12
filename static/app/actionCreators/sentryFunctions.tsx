import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
  clearIndicators,
} from 'app/actionCreators/indicator';
import {Client} from 'app/api';
import {t} from 'app/locale';
import {Organization, SentryFunction} from 'app/types';

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
