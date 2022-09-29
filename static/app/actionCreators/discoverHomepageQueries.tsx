import {Client} from 'sentry/api';
import {NewQuery, SavedQuery} from 'sentry/types';

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
