import {Client} from 'app/api';
import {SavedQuery, NewQuery} from 'app/types';
import {t} from 'app/locale';
import {addErrorMessage} from 'app/actionCreators/indicator';

export function fetchSavedQueries(api: Client, orgId: string): Promise<SavedQuery[]> {
  const promise: Promise<SavedQuery[]> = api.requestPromise(
    `/organizations/${orgId}/discover/saved/`,
    {
      method: 'GET',
      query: {query: 'version:2'},
    }
  );

  promise.catch(() => {
    addErrorMessage(t('Unable to load saved queries'));
  });
  return promise;
}

export function fetchSavedQuery(
  api: Client,
  orgId: string,
  queryId: string
): Promise<SavedQuery> {
  const promise: Promise<SavedQuery> = api.requestPromise(
    `/organizations/${orgId}/discover/saved/${queryId}/`,
    {
      method: 'GET',
    }
  );

  promise.catch(() => {
    addErrorMessage(t('Unable to load saved query'));
  });
  return promise;
}

export function createSavedQuery(
  api: Client,
  orgId: string,
  query: NewQuery
): Promise<SavedQuery> {
  const promise: Promise<SavedQuery> = api.requestPromise(
    `/organizations/${orgId}/discover/saved/`,
    {
      method: 'POST',
      data: query,
    }
  );

  promise.catch(() => {
    addErrorMessage(t('Unable to create your saved query'));
  });
  return promise;
}

export function updateSavedQuery(
  api: Client,
  orgId: string,
  query: NewQuery
): Promise<SavedQuery> {
  const promise: Promise<SavedQuery> = api.requestPromise(
    `/organizations/${orgId}/discover/saved/${query.id}/`,
    {
      method: 'PUT',
      data: query,
    }
  );

  promise.catch(() => {
    addErrorMessage(t('Unable to update your saved query'));
  });
  return promise;
}

export function deleteSavedQuery(
  api: Client,
  orgId: string,
  queryId: string
): Promise<void> {
  const promise: Promise<void> = api.requestPromise(
    `/organizations/${orgId}/discover/saved/${queryId}/`,
    {method: 'DELETE'}
  );

  promise.catch(() => {
    addErrorMessage(t('Unable to delete the saved query'));
  });
  return promise;
}
