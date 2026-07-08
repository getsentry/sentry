import type {Organization} from 'sentry/types/organization';
import type {ApiQueryKey} from 'sentry/utils/api/apiQueryKey';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';

/**
 * TODO: Convert to apiOptions
 */
export function getRepositoryWithSettingsQueryKey(
  organization: Organization,
  repoId: string
) {
  return [
    getApiUrl('/organizations/$organizationIdOrSlug/repos/$repoId/', {
      path: {organizationIdOrSlug: organization.slug, repoId},
    }),
    {query: {expand: 'settings'}},
  ] satisfies ApiQueryKey;
}
