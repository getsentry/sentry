import type {Organization} from 'sentry/types/organization';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {type ApiQueryKey} from 'sentry/utils/queryClient';

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
