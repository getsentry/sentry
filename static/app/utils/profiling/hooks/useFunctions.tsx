import {useEffect, useState} from 'react';
import * as Sentry from '@sentry/react';

import {Client} from 'sentry/api';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {t} from 'sentry/locale';
import {Organization, PageFilters, Project, RequestState} from 'sentry/types';
import {FunctionCall} from 'sentry/types/profiling/core';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

interface UseFunctionsOptions {
  project: Project;
  query: string;
  transaction: string;
  selection?: PageFilters;
}

function useFunctions({
  project,
  query,
  transaction,
  selection,
}: UseFunctionsOptions): RequestState<FunctionCall[]> {
  const api = useApi();
  const organization = useOrganization();

  const [requestState, setRequestState] = useState<RequestState<FunctionCall[]>>({
    type: 'initial',
  });

  useEffect(() => {
    if (selection === undefined) {
      return undefined;
    }

    setRequestState({type: 'loading'});

    fetchFunctions(api, organization, {
      projectSlug: project.slug,
      query,
      selection,
      transaction,
    })
      .then(functions => {
        setRequestState({
          type: 'resolved',
          data: functions.functions ?? [],
        });
      })
      .catch(err => {
        setRequestState({type: 'errored', error: t('Error: Unable to load functions')});
        Sentry.captureException(err);
      });

    return () => api.clear();
  }, [api, organization, project.slug, query, selection, transaction]);

  return requestState;
}

function fetchFunctions(
  api: Client,
  organization: Organization,
  {
    projectSlug,
    query,
    selection,
    transaction,
  }: {
    projectSlug: Project['slug'];
    query: string;
    selection: PageFilters;
    transaction: string;
  }
) {
  const conditions = new MutableSearch(query);
  conditions.setFilterValues('transaction_name', [transaction]);

  return api.requestPromise(
    `/projects/${organization.slug}/${projectSlug}/profiling/functions/`,
    {
      method: 'GET',
      includeAllArgs: false,
      query: {
        environment: selection.environments,
        ...normalizeDateTimeParams(selection.datetime),
        query: conditions.formatString(),
      },
    }
  );
}
export {useFunctions};
