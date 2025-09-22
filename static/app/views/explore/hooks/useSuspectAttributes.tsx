import {useMemo} from 'react';

import {pageFiltersToQueryParams} from 'sentry/components/organizations/pageFilters/parse';
import {getUtcDateString} from 'sentry/utils/dates';
import {FieldKey} from 'sentry/utils/fields';
import {useApiQuery} from 'sentry/utils/queryClient';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {ChartInfo} from 'sentry/views/explore/components/chart/types';
import {useExploreDataset} from 'sentry/views/explore/contexts/pageParamsContext';
import type {BoxSelectOptions} from 'sentry/views/explore/hooks/useChartBoxSelect';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';

export type SuspectAttributesResult = {
  rankedAttributes: Array<{
    attributeName: string;
    cohort1: Array<{
      label: string;
      value: string;
    }>;
    cohort2: Array<{
      label: string;
      value: string;
    }>;
    order: {
      rrf: number;
      rrr: number | null;
    };
  }>;
};

function useSuspectAttributes({
  boxSelectOptions,
  chartInfo,
}: {
  boxSelectOptions: BoxSelectOptions;
  chartInfo: ChartInfo;
}) {
  const location = useLocation();
  const organization = useOrganization();
  const dataset = useExploreDataset();
  const {selection: pageFilters} = usePageFilters();

  const enableQuery = boxSelectOptions.boxCoordRange !== null;
  const {
    x: [x1, x2],
  } = boxSelectOptions.boxCoordRange!;

  // Ensure that we pass the existing queries in the search bar to the suspect attributes queries
  const currentQuery = location.query.query?.toString() ?? '';
  const selectedRegionQuery = new MutableSearch(currentQuery);
  const baselineRegionQuery = new MutableSearch(currentQuery);

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
      function: chartInfo.yAxis,
      above: 1,
      sampling: SAMPLING_MODE.NORMAL,
    };
  }, [query1, query2, pageFilters, dataset, chartInfo.yAxis]);

  return useApiQuery<SuspectAttributesResult>(
    [
      `/organizations/${organization.slug}/trace-items/attributes/ranked/`,
      {query: queryParams},
    ],
    {
      staleTime: Infinity,
      enabled: enableQuery,
    }
  );
}

export default useSuspectAttributes;
