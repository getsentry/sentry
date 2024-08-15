import {useMemo} from 'react';

import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

interface UseProfilingFunctionMetricsProps {
  fingerprint: Profiling.FunctionMetric['fingerprint'];
  projects: number[];
  query?: string;
}

export function useProfilingFunctionMetrics(props: UseProfilingFunctionMetricsProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const path = `/organizations/${organization.slug}/events-stats/`;
  const endpointOptions = useMemo(() => {
    const params: {
      query: Record<string, any>;
    } = {
      query: {
        project: props.projects,
        environment: selection.environments ?? selection.environments,
        ...normalizeDateTimeParams(selection.datetime ?? selection.datetime),
        dataSource: 'profilesMetrics',
        fingerprint: props.fingerprint,
        query: props.query,
      },
    };

    return params;
  }, [
    props.fingerprint,
    props.query,
    props.projects,
    selection.datetime,
    selection.environments,
  ]);

  return useApiQuery([path, endpointOptions], {
    enabled: !!props.fingerprint,
    staleTime: 0,
  });
}
