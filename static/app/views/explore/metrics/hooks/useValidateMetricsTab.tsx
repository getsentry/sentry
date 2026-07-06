import {useQuery, skipToken} from '@tanstack/react-query';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  useQueryParamsAggregateSortBys,
  useQueryParamsGroupBys,
  useQueryParamsQuery,
  useQueryParamsVisualizes,
} from 'sentry/views/explore/queryParams/context';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {validateEventParamsOptions} from 'sentry/views/explore/utils/validateEventParamsOptions';

type UseValidateMetricsTabArgs = {
  enabled?: boolean;
  environments?: string[];
  projectIds?: Array<string | number>;
};

export function useValidateMetricsTab({
  enabled = true,
  environments,
  projectIds,
}: UseValidateMetricsTabArgs = {}) {
  const {selection} = usePageFilters();
  const organization = useOrganization();

  const query = useQueryParamsQuery();
  const sortBys = useQueryParamsAggregateSortBys();
  const groupBys = useQueryParamsGroupBys();
  const visualizes = useQueryParamsVisualizes({validate: true});

  const {data, isLoading} = useQuery({
    ...validateEventParamsOptions({
      organization,
      selection,
      traceItemType: TraceItemDataset.TRACEMETRICS,
      environments,
      field: Array.from(
        new Set([
          ...groupBys.filter(groupBy => groupBy !== ''),
          ...visualizes.map(visualize => visualize.yAxis).filter(Boolean),
        ])
      ),
      orderBy: sortBys.map(sortBy =>
        sortBy.kind === 'desc' ? `-${sortBy.field}` : sortBy.field
      ),
      query,
      projectIds,
    }),
    // using skipToken is the new preferred way to skip a query
    ...(enabled ? {} : {queryFn: skipToken}),
  });

  return {
    data,
    isLoading,
  };
}
