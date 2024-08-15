import {useMemo} from 'react';

import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

interface BaseAggregateFlamegraphQueryParameters {
  datetime?: PageFilters['datetime'];
  enabled?: boolean;
  environments?: PageFilters['environments'];
  metrics?: true;
  projects?: PageFilters['projects'];
}

interface FunctionsAggregateFlamegraphQueryParameters
  extends BaseAggregateFlamegraphQueryParameters {
  query: string;
  dataSource?: 'functions';
  fingerprint?: string;
}

interface TransactionsAggregateFlamegraphQueryParameters
  extends BaseAggregateFlamegraphQueryParameters {
  query: string;
  dataSource?: 'transactions';
}

interface ProfilesAggregateFlamegraphQueryParameters
  extends BaseAggregateFlamegraphQueryParameters {
  // query is not supported when querying from profiles
  dataSource: 'profiles';
}

export type AggregateFlamegraphQueryParameters =
  | FunctionsAggregateFlamegraphQueryParameters
  | TransactionsAggregateFlamegraphQueryParameters
  | ProfilesAggregateFlamegraphQueryParameters;

export type UseAggregateFlamegraphQueryResult = UseApiQueryResult<
  Profiling.Schema,
  RequestError
>;

export function useAggregateFlamegraphQuery(
  props: AggregateFlamegraphQueryParameters
): UseAggregateFlamegraphQueryResult {
  const {dataSource, metrics, datetime, enabled, environments, projects} = props;

  let fingerprint: string | undefined = undefined;
  let query: string | undefined = undefined;

  if (isDataSourceFunctions(props)) {
    fingerprint = props.fingerprint;
    query = props.query;
  } else if (isDataSourceTransactions(props)) {
    query = props.query;
  }

  const organization = useOrganization();
  const {selection} = usePageFilters();

  const endpointOptions = useMemo(() => {
    const params: {
      query: Record<string, any>;
    } = {
      query: {
        project: projects ?? selection.projects,
        environment: environments ?? selection.environments,
        ...normalizeDateTimeParams(datetime ?? selection.datetime),
        dataSource,
        fingerprint,
        query,
      },
    };

    if (metrics) {
      params.query.expand = 'metrics';
    }

    return params;
  }, [
    dataSource,
    datetime,
    environments,
    projects,
    fingerprint,
    query,
    metrics,
    selection,
  ]);

  return useApiQuery<Profiling.Schema>(
    [`/organizations/${organization.slug}/profiling/flamegraph/`, endpointOptions],
    {
      staleTime: 0,
      retry: false,
      enabled,
    }
  );
}

function isDataSourceProfiles(
  props: AggregateFlamegraphQueryParameters
): props is ProfilesAggregateFlamegraphQueryParameters {
  return 'dataSource' in props && props.dataSource === 'profiles';
}

function isDataSourceFunctions(
  props: AggregateFlamegraphQueryParameters
): props is FunctionsAggregateFlamegraphQueryParameters {
  return 'fingerprint' in props;
}

function isDataSourceTransactions(
  props: AggregateFlamegraphQueryParameters
): props is TransactionsAggregateFlamegraphQueryParameters {
  return !isDataSourceProfiles(props) && !isDataSourceFunctions(props);
}
