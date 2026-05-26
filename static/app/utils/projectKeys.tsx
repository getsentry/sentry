import {skipToken} from '@tanstack/react-query';

import type {Organization} from 'sentry/types/organization';
import type {Project, ProjectKey} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';

interface ProjectKeysParameters {
  orgSlug: Organization['slug'];
  projSlug?: Project['slug'];
  query?: {
    cursor?: string;
    per_page?: number;
  };
}

export function projectKeysApiOptions(params: ProjectKeysParameters) {
  return apiOptions.as<ProjectKey[]>()(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/keys/',
    {
      path: params.projSlug
        ? {
            organizationIdOrSlug: params.orgSlug,
            projectIdOrSlug: params.projSlug,
          }
        : skipToken,
      query: params.query,
      staleTime: 0,
    }
  );
}
