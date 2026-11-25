import {skipToken, useInfiniteQuery} from '@tanstack/react-query';

import {chartStaleTime} from 'sentry/components/charts/chartStaleTime';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {useFetchAllPages} from 'sentry/utils/api/apiFetch';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useOrganization} from 'sentry/utils/useOrganization';

import type {TimeseriesAnnotation} from './timeseriesAnnotation';

const MAX_PAGES = 10;

const DATASET_SCOPES: Partial<Record<DiscoverDatasets, TimeseriesAnnotation['scope']>> = {
  [DiscoverDatasets.SPANS]: 'spans',
  [DiscoverDatasets.OURLOGS]: 'logs',
  [DiscoverDatasets.TRACEMETRICS]: 'tracemetrics',
  [DiscoverDatasets.ERRORS]: 'errors',
};

interface UseTimeseriesAnnotationsParams {
  dataset: DiscoverDatasets;
  enabled: boolean;
  interval: string;
}

export function useTimeseriesAnnotations({
  dataset,
  interval,
  enabled,
}: UseTimeseriesAnnotationsParams) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const datasetScope = DATASET_SCOPES[dataset];

  const result = useInfiniteQuery(
    apiOptions.asInfinite<TimeseriesAnnotation[]>()(
      '/organizations/$organizationIdOrSlug/timeseries-annotations/',
      {
        path: enabled ? {organizationIdOrSlug: organization.slug} : skipToken,
        query: {
          ...normalizeDateTimeParams(selection.datetime),
          project: selection.projects,
          environment: selection.environments,
          scope: datasetScope ? [datasetScope, 'global'] : ['global'],
        },
        staleTime: chartStaleTime(selection.datetime, interval),
      }
    )
  );

  const pageCount = result.data?.pages.length ?? 0;
  useFetchAllPages({result, enabled: pageCount < MAX_PAGES});

  return result.data?.pages.flatMap(page => page.json);
}
