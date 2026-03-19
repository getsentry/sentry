import {useMemo} from 'react';

import {pageFiltersToQueryParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {PageFilters} from 'sentry/types/core';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {getUtcDateString} from 'sentry/utils/dates';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {FieldKey} from 'sentry/utils/fields';
import {useApiQuery} from 'sentry/utils/queryClient';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';

export type AttributeBreakdownsComparison = {
  cohort1Total: number;
  cohort2Total: number;
  rankedAttributes: Array<{
    attributeName: string;
    cohort1: Array<{
      label: string;
      value: number;
    }>;
    cohort2: Array<{
      label: string;
      value: number;
    }>;
    order: {
      rrf: number;
      rrr: number | null;
    };
  }>;
};

export function useAttributeBreakdownComparison({
  aggregateFunction,
  range,
  query,
  dataset = DiscoverDatasets.SPANS,
  extrapolate = '1',
  pageFilters: pageFiltersProp,
}: {
  aggregateFunction: string;
  query: string;
  range: [number, number];
  dataset?: DiscoverDatasets;
  extrapolate?: string;
  pageFilters?: PageFilters;
}) {
  const organization = useOrganization();
  const {selection: contextPageFilters} = usePageFilters();
  const pageFilters = pageFiltersProp ?? contextPageFilters;

  const [x1, x2] = range;

  const selectedRegionQuery = new MutableSearch(query);
  const baselineRegionQuery = new MutableSearch(query);

  // round off the x-axis bounds to the minute
  let startTimestamp = Math.floor(x1 / 60_000) * 60_000;
  const endTimestamp = Math.ceil(x2 / 60_000) * 60_000;

  // ensure the x-axis bounds have 1 minute resolution
  startTimestamp = Math.min(startTimestamp, endTimestamp - 60_000);

  const formattedStartTimestamp = getUtcDateString(startTimestamp);
  const formattedEndTimestamp = getUtcDateString(endTimestamp);

  // Add the selected region by x-axis to the query, timestamp: [x1, x2]
  selectedRegionQuery.addFilterValue(FieldKey.TIMESTAMP, `>=${formattedStartTimestamp}`);
  selectedRegionQuery.addFilterValue(FieldKey.TIMESTAMP, `<=${formattedEndTimestamp}`);

  const query1 = selectedRegionQuery.formatString();
  const query2 = baselineRegionQuery.formatString();

  const queryParams = useMemo(() => {
    return {
      ...pageFiltersToQueryParams(pageFilters),
      query_1: query1,
      query_2: query2,
      dataset,
      function: aggregateFunction,
      above: 1,
      sampling: SAMPLING_MODE.NORMAL,
      aggregateExtrapolation: extrapolate,
    };
  }, [query1, query2, pageFilters, dataset, aggregateFunction, extrapolate]);

  return useApiQuery<AttributeBreakdownsComparison>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/trace-items/attributes/ranked/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {query: queryParams},
    ],
    {
      staleTime: 0,
      enabled: !!aggregateFunction && !!range,
    }
  );
}
