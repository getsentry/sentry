import {useQuery, skipToken} from '@tanstack/react-query';

import {pageFiltersToQueryParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {useCaseInsensitivity} from 'sentry/components/searchQueryBuilder/hooks';
import type {PageFilters} from 'sentry/types/core';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {getUtcDateString} from 'sentry/utils/dates';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {FieldKey} from 'sentry/utils/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useOrganization} from 'sentry/utils/useOrganization';

import {SAMPLING_MODE} from './useProgressiveQuery';

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
  yAttribute,
  yRange,
}: {
  aggregateFunction: string;
  query: string;
  range: [number, number];
  dataset?: DiscoverDatasets;
  extrapolate?: string;
  pageFilters?: PageFilters;
  /**
   * Attribute that `yRange` bounds, e.g. `span.duration` for a heatmap selection.
   */
  yAttribute?: string;
  yRange?: [number, number];
}) {
  const organization = useOrganization();
  const {selection: contextPageFilters} = usePageFilters();
  const pageFilters = pageFiltersProp ?? contextPageFilters;
  const [caseInsensitive] = useCaseInsensitivity();

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

  if (yAttribute && yRange) {
    selectedRegionQuery.addFilterValue(yAttribute, `>=${yRange[0]}`, false);
    selectedRegionQuery.addFilterValue(yAttribute, `<${yRange[1]}`, false);
  }

  return useQuery({
    ...apiOptions.as<AttributeBreakdownsComparison>()(
      '/organizations/$organizationIdOrSlug/trace-items/attributes/ranked/',
      {
        path:
          !!aggregateFunction && !!range
            ? {organizationIdOrSlug: organization.slug}
            : skipToken,
        query: {
          ...pageFiltersToQueryParams(pageFilters),
          above: 1,
          dataset,
          function: aggregateFunction,
          query_1: selectedRegionQuery.formatString(),
          query_2: baselineRegionQuery.formatString(),
          sampling: SAMPLING_MODE.NORMAL,
          aggregateExtrapolation: extrapolate,
          caseInsensitive: caseInsensitive ? '1' : undefined,
        },
        staleTime: 0,
      }
    ),
    select: selectJsonWithHeaders,
  });
}
