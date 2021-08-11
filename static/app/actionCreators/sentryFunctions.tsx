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
  _org: Organization,
  sentryFn: SentryFunction
): Promise<undefined> {
  addLoadingMessage();
  const promise = client.requestPromise('/sentry', {
    // TODO: set correct url
    method: 'DELETE',
  });
  promise.then(
    () => {
      addSuccessMessage(t('%s successfully removed.', sentryFn.name));
    },
    () => {
      clearIndicators();
      addErrorMessage(t('Unable to remove %s integration', sentryFn.name));
    }
  );
  return promise;
}
