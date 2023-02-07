import {useQuery} from '@tanstack/react-query';

import {Client, ResponseMeta} from 'sentry/api';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {PageFilters, Project} from 'sentry/types';
import {SuspectFunction} from 'sentry/types/profiling/core';
import RequestError from 'sentry/utils/requestError/requestError';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

type FunctionsResult = {
  functions: SuspectFunction[];
  pageLinks: string | null;
};

interface UseFunctionsOptions {
  project: Project;
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

  const path = `/projects/${organization.slug}/${project.slug}/profiling/functions/`;
  const fetchFunctionsOptions = {
    functionType,
    query,
    selection,
    sort,
    transaction,
    cursor,
  };
  const queryKey = [path, fetchFunctionsOptions];

  const queryFn = () => {
    return fetchFunctions(api, path, fetchFunctionsOptions);
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
  functionType: 'application' | 'system' | 'all' | undefined;
  query: string;
  selection: PageFilters | undefined;
  sort: string;
  transaction: string | null;
}

type FetchFunctionsReturn =
  | [FunctionsResult, string | undefined, ResponseMeta | undefined]
  | undefined;
function fetchFunctions(
  api: Client,
  path: string,
  {cursor, functionType, query, selection, sort, transaction}: FetchFunctionsOptions
): Promise<FetchFunctionsReturn> {
  if (!selection || !transaction) {
    throw Error('selection and transaction arguments required for fetchFunctions');
  }

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
