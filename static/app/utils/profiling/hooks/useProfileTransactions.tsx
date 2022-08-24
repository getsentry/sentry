import {useEffect, useState} from 'react';
import * as Sentry from '@sentry/react';

import {Client} from 'sentry/api';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {t} from 'sentry/locale';
import {Organization, PageFilters, RequestState} from 'sentry/types';
import {ProfileTransaction} from 'sentry/types/profiling/core';
import {defined} from 'sentry/utils';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

type ProfileTransactionsResult = {
  pageLinks: string | null;
  transactions: ProfileTransaction[];
};

interface UseProfileTransactionsOptions {
  query: string;
  cursor?: string;
  limit?: number;
  selection?: PageFilters;
}

function useProfileTransactions({
  cursor,
  limit,
  query,
  selection,
}: UseProfileTransactionsOptions): RequestState<ProfileTransactionsResult> {
  const api = useApi();
  const organization = useOrganization();

  const [requestState, setRequestState] = useState<
    RequestState<ProfileTransactionsResult>
  >({
    type: 'initial',
  });

  useEffect(() => {
    if (!defined(selection)) {
      return undefined;
    }

    setRequestState({type: 'loading'});

    fetchTransactions(api, organization, {cursor, limit, query, selection})
      .then(([transactions, , response]) => {
        setRequestState({
          type: 'resolved',
          data: {
            transactions,
            pageLinks: response?.getResponseHeader('Link') ?? null,
          },
        });
      })
      .catch(err => {
        setRequestState({
          type: 'errored',
          error: t('Error: Unable to load transactions'),
        });
        Sentry.captureException(err);
      });

    return () => api.clear();
  }, [api, organization, cursor, limit, query, selection]);

  return requestState;
}

function fetchTransactions(
  api: Client,
  organization: Organization,
  {
    cursor,
    limit,
    query,
    selection,
  }: {
    cursor: string | undefined;
    limit: number | undefined;
    query: string;
    selection: PageFilters;
  }
) {
  return api.requestPromise(
    `/organizations/${organization.slug}/profiling/transactions/`,
    {
      method: 'GET',
      includeAllArgs: true,
      query: {
        cursor,
        query,
        per_page: limit,
        project: selection.projects,
        environment: selection.environments,
        ...normalizeDateTimeParams(selection.datetime),
      },
    }
  );
}

export {useProfileTransactions};
