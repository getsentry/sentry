import {useEffect, useState} from 'react';
import * as Sentry from '@sentry/react';

import {Client} from 'sentry/api';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {t} from 'sentry/locale';
import type {Organization, PageFilters, Project, RequestState} from 'sentry/types';
import {SuspectFunction} from 'sentry/types/profiling/core';
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
  transaction: string;
  cursor?: string;
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
}: UseFunctionsOptions): RequestState<FunctionsResult> {
  const api = useApi();
  const organization = useOrganization();

  const [requestState, setRequestState] = useState<RequestState<FunctionsResult>>({
    type: 'initial',
  });

  useEffect(() => {
    if (selection === undefined) {
      return undefined;
    }

    setRequestState({type: 'loading'});

    fetchFunctions(api, organization, {
      functionType,
      projectSlug: project.slug,
      query,
      selection,
      sort,
      transaction,
      cursor,
    })
      .then(([functions, , response]) => {
        setRequestState({
          type: 'resolved',
          data: {
            functions: functions.functions ?? [],
            pageLinks: response?.getResponseHeader('Link') ?? null,
          },
        });
      })
      .catch(err => {
        setRequestState({type: 'errored', error: t('Error: Unable to load functions')});
        Sentry.captureException(err);
      });

    return () => api.clear();
  }, [
    api,
    cursor,
    functionType,
    organization,
    project.slug,
    query,
    selection,
    sort,
    transaction,
  ]);

  return requestState;
}

function fetchFunctions(
  api: Client,
  organization: Organization,
  {
    cursor,
    functionType,
    projectSlug,
    query,
    selection,
    sort,
    transaction,
  }: {
    cursor: string | undefined;
    functionType: 'application' | 'system' | 'all' | undefined;
    projectSlug: Project['slug'];
    query: string;
    selection: PageFilters;
    sort: string;
    transaction: string;
  }
) {
  const conditions = new MutableSearch(query);
  conditions.setFilterValues('transaction_name', [transaction]);

  return api.requestPromise(
    `/projects/${organization.slug}/${projectSlug}/profiling/functions/`,
    {
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
    }
  );
}
export {useFunctions};
