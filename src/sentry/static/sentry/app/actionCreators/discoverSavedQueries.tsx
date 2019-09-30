import {Client} from 'app/api';

import {SavedQuery, NewQuery} from 'app/stores/discoverSavedQueriesStore';
import DiscoverSavedQueryActions from 'app/actions/discoverSavedQueryActions';
import {t} from 'app/locale';
import {addErrorMessage} from 'app/actionCreators/indicator';

export function fetchSavedQueries(api: Client, orgId: string): Promise<SavedQuery[]> {
  DiscoverSavedQueryActions.startFetchSavedQueries();

  const promise = api.requestPromise(`/organizations/${orgId}/discover/saved/`, {
    method: 'GET',
  });
  promise
    .then(resp => {
      DiscoverSavedQueryActions.fetchSavedQueriesSuccess(resp);
    })
    .catch(() => {
      DiscoverSavedQueryActions.fetchSavedQueriesError();
      addErrorMessage(t('Unable to load saved queries'));
    });
  return promise;
}

export function createSavedQuery(
  api: Client,
  orgId: string,
  query: NewQuery
): Promise<SavedQuery> {
  const promise = api.requestPromise(`/organizations/${orgId}/discover/saved/`, {
    method: 'POST',
    data: query,
  });
  promise
    .then(resp => {
      DiscoverSavedQueryActions.createSavedQuerySuccess(resp);
    })
    .catch(() => {
      addErrorMessage(t('Unable to create your saved query'));
    });
  return promise;
}

export function updateSavedQuery(
  api: Client,
  orgId: string,
  query: NewQuery
): Promise<SavedQuery> {
  const promise = api.requestPromise(
    `/organizations/${orgId}/discover/saved/${query.id}/`,
    {
      method: 'PUT',
      data: query,
    }
  );
  promise
    .then(resp => {
      DiscoverSavedQueryActions.updateSavedQuerySuccess(resp);
    })
    .catch(() => {
      addErrorMessage(t('Unable to update your saved query'));
    });
  return promise;
}

export function deleteSavedQuery(
  api: Client,
  orgId: string,
  queryId: string
): Promise<null> {
  const promise = api.requestPromise(
    `/organizations/${orgId}/discover/saved/${queryId}/`,
    {method: 'DELETE'}
  );
  promise
    .then(() => {
      DiscoverSavedQueryActions.deleteSavedQuerySuccess(queryId);
    })
    .catch(() => {
      addErrorMessage(t('Unable to delete the saved query'));
    });

  return promise;
}
