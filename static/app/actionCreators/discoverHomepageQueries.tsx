import {Client} from 'sentry/api';
import {NewQuery, SavedQuery} from 'sentry/types';

export function fetchHomepageQuery(api: Client, orgId: string): Promise<SavedQuery> {
  return api.requestPromise(`/organizations/${orgId}/discover/homepage/`, {
    method: 'GET',
  });
}

export function updateHomepageQuery(
  api: Client,
  orgId: string,
  query: NewQuery
): Promise<SavedQuery> {
  return api.requestPromise(`/organizations/${orgId}/discover/homepage/`, {
    method: 'PUT',
    data: query,
  });
}

export function deleteHomepageQuery(api: Client, orgId: string): Promise<void> {
  return api.requestPromise(`/organizations/${orgId}/discover/homepage/`, {
    method: 'DELETE',
  });
}
