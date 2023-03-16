import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {useCurrentProjectFromRouteParam} from 'sentry/utils/profiling/hooks/useCurrentProjectFromRouteParam';
import {useQuery} from 'sentry/utils/queryClient';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

export function useAggregateFlamegraphQuery({transaction}: {transaction: string}) {
  const {selection} = usePageFilters();
  const organization = useOrganization();
  const project = useCurrentProjectFromRouteParam();
  const url = `/projects/${organization.slug}/${project?.slug}/profiling/flamegraph/`;
  const conditions = new MutableSearch([]);
  conditions.setFilterValues('transaction_name', [transaction]);

  return useQuery<Profiling.Schema>(
    [
      url,
      {
        query: {
          query: conditions.formatString(),
          ...normalizeDateTimeParams(selection.datetime),
        },
      },
    ],
    {
      staleTime: 0,
      retry: false,
      enabled: Boolean(organization?.slug && project?.slug && selection.datetime),
    }
  );
}
