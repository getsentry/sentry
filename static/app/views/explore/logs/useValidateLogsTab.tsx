import {skipToken, useQuery} from '@tanstack/react-query';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  useQueryParamsAggregateSortBys,
  useQueryParamsFields,
  useQueryParamsGroupBys,
  useQueryParamsSearch,
  useQueryParamsSortBys,
  useQueryParamsVisualizes,
} from 'sentry/views/explore/queryParams/context';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {validateEventParamsOptions} from 'sentry/views/explore/utils/validateEventParamsOptions';

type UseValidateLogsTabArgs = {
  enabled?: boolean;
};

export function useValidateLogsTab({enabled = true}: UseValidateLogsTabArgs = {}) {
  const {selection} = usePageFilters();
  const organization = useOrganization();

  const search = useQueryParamsSearch();
  const fields = useQueryParamsFields();
  const sortBys = useQueryParamsSortBys();
  const aggregateSortBys = useQueryParamsAggregateSortBys();
  const groupBys = useQueryParamsGroupBys();
  const visualizes = useQueryParamsVisualizes();

  const {data, isLoading} = useQuery({
    ...validateEventParamsOptions({
      organization,
      selection,
      traceItemType: TraceItemDataset.LOGS,
      environments: selection.environments,
      field: Array.from(
        new Set([
          ...fields,
          ...groupBys.filter(groupBy => groupBy !== ''),
          ...visualizes.map(visualize => visualize.yAxis),
        ])
      ),
      orderBy: [...sortBys, ...aggregateSortBys].map(sortBy =>
        sortBy.kind === 'desc' ? `-${sortBy.field}` : sortBy.field
      ),
      query: search.formatString(),
      projectIds: selection.projects,
    }),
    // using skipToken is the new preferred way to skip a query
    ...(enabled ? {} : {queryFn: skipToken}),
  });

  return {
    data,
    isLoading,
  };
}
