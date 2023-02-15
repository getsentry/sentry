import {useQuery} from '@tanstack/react-query';

import {Client, ResponseMeta} from 'sentry/api';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {PageFilters, Project} from 'sentry/types';
import {SuspectFunction} from 'sentry/types/profiling/core';
import {defined} from 'sentry/utils';
import RequestError from 'sentry/utils/requestError/requestError';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

type FunctionsResult = {
  functions: SuspectFunction[];
  pageLinks: string | null;
};

interface UseFunctionsOptions {
  project: Project | undefined;
  query: string;
  sort: string;
  transaction: string | null;
  cursor?: string;
  enabled?: boolean;
  functionType?: 'application' | 'system' | 'all';
  selection?: PageFilters;
}

function useFunctions({
  functionType,
  project,
  query,
  transaction,
  sort,
  cursor,
  selection,
  enabled = true,
}: UseFunctionsOptions) {
  const api = useApi();
  const organization = useOrganization();

  const path = `/projects/${organization.slug}/${project?.slug}/profiling/functions/`;
  const fetchFunctionsOptions = {
    functionType,
    query,
    selection,
    sort,
    transaction,
    cursor,
    enabled,
  };
  const queryKey = [path, fetchFunctionsOptions];

  const queryFn = () => {
    if (
      !defined(fetchFunctionsOptions.selection) ||
      !defined(fetchFunctionsOptions.transaction) ||
      !defined(project)
    ) {
      throw Error(
        'selection, transaction and project arguments required for fetchFunctions'
      );
    }

    return fetchFunctions(
      api,
      path,
      // tsc doesn't infer the new type from the assertion above??
      fetchFunctionsOptions as FetchFunctionsOptions
    );
  };

  return useQuery<FetchFunctionsReturn, RequestError>({
    queryKey,
    queryFn,
    refetchOnWindowFocus: false,
    retry: false,
    enabled,
  });
}

interface FetchFunctionsOptions {
  cursor: string | undefined;
  enabled: boolean;
  functionType: 'application' | 'system' | 'all' | undefined;
  query: string;
  selection: PageFilters;
  sort: string;
  transaction: string;
}

type FetchFunctionsReturn =
  | [FunctionsResult, string | undefined, ResponseMeta | undefined]
  | undefined;
function fetchFunctions(
  api: Client,
  path: string,
  {cursor, functionType, query, selection, sort, transaction}: FetchFunctionsOptions
): Promise<FetchFunctionsReturn> {
  const conditions = new MutableSearch(query);
  conditions.setFilterValues('transaction_name', [transaction]);

  return api.requestPromise(path, {
    method: 'GET',
    includeAllArgs: true,
    query: {
      cursor,
      environment: selection.environments,
      ...normalizeDateTimeParams(selection.datetime),
      query: conditions.formatString(),
      sort,
      is_application:
        functionType === 'application'
          ? '1'
          : functionType === 'system'
          ? '0'
          : undefined,
    },
  });
}
export {useFunctions};
