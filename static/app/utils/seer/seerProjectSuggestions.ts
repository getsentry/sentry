import {skipToken} from '@tanstack/react-query';

import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {SeerProjectSuggestionResponse} from 'sentry/utils/seer/types';

export function getInfiniteSeerProjectSuggestionsQueryOptions({
  organization,
  enabled,
}: {
  enabled: boolean;
  organization: Organization;
}) {
  return apiOptions.asInfinite<SeerProjectSuggestionResponse[]>()(
    '/organizations/$organizationIdOrSlug/seer/project-suggestions/',
    {
      path: enabled ? {organizationIdOrSlug: organization.slug} : skipToken,
      query: {per_page: 10},
      staleTime: 60_000,
    }
  );
}
