import {useMemo} from 'react';

import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import type {EventsStatsData} from 'sentry/types/organization';
import {useApiQuery, type UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

interface UseProfilingFunctionMetricsProps {
  fingerprint: Profiling.FunctionMetric['fingerprint'];
  projects: number[];
}

export function useProfilingFunctionMetrics(
  props: UseProfilingFunctionMetricsProps
): UseApiQueryResult<{data: EventsStatsData}, RequestError> {
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
        dataset: 'profileFunctionsMetrics',
        query: `fingerprint:${props.fingerprint}`,
        ...normalizeDateTimeParams(selection.datetime ?? selection.datetime),
      },
    };
    return params;
  }, [props.fingerprint, props.projects, selection.datetime, selection.environments]);

  return useApiQuery<{data: EventsStatsData}>([path, endpointOptions], {
    enabled: !!props.fingerprint,
    staleTime: 0,
  });
}
