import {useEffect, useState} from 'react';
import * as Sentry from '@sentry/react';

import {Client} from 'sentry/api';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {t} from 'sentry/locale';
import {Organization, PageFilters, RequestState} from 'sentry/types';
import {Trace} from 'sentry/types/profiling/core';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

type ProfilesResult = {
  pageLinks: string | null;
  traces: Trace[];
};

interface UseProfilesOptions {
  query: string;
  cursor?: string;
  limit?: number;
  selection?: PageFilters;
}

function useProfiles({
  cursor,
  limit,
  query,
  selection,
}: UseProfilesOptions): RequestState<ProfilesResult> {
  const api = useApi();
  const organization = useOrganization();

  const [requestState, setRequestState] = useState<RequestState<ProfilesResult>>({
    type: 'initial',
  });

  useEffect(() => {
    if (selection === undefined) {
      return undefined;
    }

    setRequestState({type: 'loading'});

    fetchTraces(api, organization, {cursor, limit, query, selection})
      .then(([traces, , response]) => {
        setRequestState({
          type: 'resolved',
          data: {
            traces,
            pageLinks: response?.getResponseHeader('Link') ?? null,
          },
        });
      })
      .catch(err => {
        setRequestState({type: 'errored', error: t('Error: Unable to load profiles')});
        Sentry.captureException(err);
      });

    return () => api.clear();
  }, [api, organization, cursor, limit, query, selection]);

  return requestState;
}

function fetchTraces(
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
  return api.requestPromise(`/organizations/${organization.slug}/profiling/profiles/`, {
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
  });
}

export {useProfiles};
