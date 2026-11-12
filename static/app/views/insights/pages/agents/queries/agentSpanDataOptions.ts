import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {DiscoverDatasets} from 'sentry/utils/discover/types';

export function agentSpanDataOptions({
  organizationSlug,
  selection,
  query,
  referrer,
}: {
  organizationSlug: string;
  query: string;
  referrer: string;
  selection: PageFilters;
}) {
  return apiOptions.as<{data: Array<{id: string}>}>()(
    '/organizations/$organizationIdOrSlug/events/',
    {
      path: {organizationIdOrSlug: organizationSlug},
      query: {
        dataset: DiscoverDatasets.SPANS,
        field: ['id'],
        per_page: 1,
        project: selection.projects,
        environment: selection.environments,
        ...normalizeDateTimeParams(selection.datetime),
        query,
        referrer,
      },
      staleTime: 0,
    }
  );
}
