import type {Client} from 'sentry/api';
import type {NewQuery, SavedQuery} from 'sentry/types/organization';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';

export function fetchHomepageQuery(api: Client, orgId: string): Promise<SavedQuery> {
  return api.requestPromise(
    getApiUrl('/organizations/$organizationIdOrSlug/discover/homepage/', {
      path: {organizationIdOrSlug: orgId},
    }),
    {
      method: 'GET',
    }
  );
}

export function updateHomepageQuery(
  api: Client,
  orgId: string,
  query: NewQuery
): Promise<SavedQuery> {
  return api.requestPromise(
    getApiUrl('/organizations/$organizationIdOrSlug/discover/homepage/', {
      path: {organizationIdOrSlug: orgId},
    }),
    {
      method: 'PUT',
      data: query,
    }
  );
}

export function deleteHomepageQuery(api: Client, orgId: string): Promise<void> {
  return api.requestPromise(
    getApiUrl('/organizations/$organizationIdOrSlug/discover/homepage/', {
      path: {organizationIdOrSlug: orgId},
    }),
    {
      method: 'DELETE',
    }
  );
}
