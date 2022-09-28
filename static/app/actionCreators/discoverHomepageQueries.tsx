import {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import {NewQuery, SavedQuery} from 'sentry/types';

import {addErrorMessage} from './indicator';

export function updateHomepageQuery(
  api: Client,
  orgId: string,
  query: NewQuery
): Promise<SavedQuery> {
  const promise: Promise<SavedQuery> = api.requestPromise(
    `/organizations/${orgId}/discover/homepage/`,
    {
      method: 'PUT',
      data: query,
    }
  );

  promise.catch(() => {
    addErrorMessage(t('Unable to set query as Default Discover Query'));
  });
  return promise;
}
