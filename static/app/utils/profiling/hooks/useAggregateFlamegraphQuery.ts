import {useMemo} from 'react';

import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {PageFilters} from 'sentry/types';
import {useApiQuery, UseApiQueryResult} from 'sentry/utils/queryClient';
import RequestError from 'sentry/utils/requestError/requestError';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';

type AggregateFlamegraphQueryParametersWithoutFingerprint = {
  datetime: Partial<PageFilters['datetime']>;
  environments: string[];
  projects: number[];
  transaction: string;
};

interface AggregateFlamegraphQueryParametersWithFingerprint
  extends AggregateFlamegraphQueryParametersWithoutFingerprint {
  fingerprint: string;
}

export type AggregateFlamegraphQueryParameters =
  | AggregateFlamegraphQueryParametersWithoutFingerprint
  | AggregateFlamegraphQueryParametersWithFingerprint;

export type UseAggregateFlamegraphQueryResult = UseApiQueryResult<
  Profiling.Schema,
  RequestError
>;

export function useAggregateFlamegraphQuery(
  props: AggregateFlamegraphQueryParameters
): UseAggregateFlamegraphQueryResult {
  const organization = useOrganization();

  const query = useMemo(() => {
    // TODO: this should contain the user query
    // wait util we fully switch over to the transactions dataset
    const conditions = new MutableSearch([]);
    conditions.setFilterValues('transaction', [props.transaction]);
    return conditions.formatString();
  }, [props.transaction]);

  const enabled =
    !!props.transaction && Array.isArray(props.projects) && props.projects.length > 0;
  const endpointOptions = useMemo(() => {
    const params = {
      query: {
        project: props.projects,
        environment: props.environments,
        ...normalizeDateTimeParams(props.datetime),
        query,
      },
    };

    if ('fingerprint' in props) {
      return {
        query: {
          ...params.query,
          fingerprint: props.fingerprint,
        },
      };
    }

    return params;
  }, [props, query]);

  return useApiQuery<Profiling.Schema>(
    [`/organizations/${organization.slug}/profiling/flamegraph/`, endpointOptions],
    {
      staleTime: 0,
      retry: false,
      enabled,
    }
  );
}
