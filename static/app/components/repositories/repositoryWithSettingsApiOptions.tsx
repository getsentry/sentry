import type {RepositoryWithSettings} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';

export function repositoryWithSettingsApiOptions(
  organization: Organization,
  repoId: string
) {
  return apiOptions.as<RepositoryWithSettings>()(
    '/organizations/$organizationIdOrSlug/repos/$repoId/',
    {
      path: {organizationIdOrSlug: organization.slug, repoId},
      query: {expand: 'settings'},
      staleTime: 0,
    }
  );
}
