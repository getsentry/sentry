import {useEffect, useState} from 'react';

import {Client, ResponseMeta} from 'sentry/api';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {Organization, PageFilters} from 'sentry/types';
import {Trace} from 'sentry/types/profiling/core';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

type RequestState = 'initial' | 'loading' | 'resolved' | 'errored';

function fetchTraces(
  api: Client,
  query: string | undefined,
  cursor: string | undefined,
  organization: Organization,
  selection: PageFilters
): Promise<[Trace[], string | undefined, ResponseMeta | undefined]> {
  return api.requestPromise(`/organizations/${organization.slug}/profiling/profiles/`, {
    method: 'GET',
    includeAllArgs: true,
    query: {
      cursor,
      query,
      project: selection.projects,
      environment: selection.environments,
      ...normalizeDateTimeParams(selection.datetime),
    },
  });
}

interface UseProfilesOptions {
  cursor: string | undefined;
  query: string | undefined;
  selection: PageFilters | undefined;
}

function useProfiles({
  cursor,
  query,
  selection,
}: UseProfilesOptions): [RequestState, Trace[], string | null] {
  const api = useApi();
  const organization = useOrganization();

  const [requestState, setRequestState] = useState<RequestState>('initial');
  const [traces, setTraces] = useState<Trace[]>([]);
  const [pageLinks, setPageLinks] = useState<string | null>(null);

  useEffect(() => {
    if (selection === undefined) {
      return;
    }

    api.clear();
    setRequestState('loading');

    fetchTraces(api, query, cursor, organization, selection)
      .then(([_traces, , response]) => {
        setTraces(_traces);
        setPageLinks(response?.getResponseHeader('Link') ?? null);
        setRequestState('resolved');
      })
      .catch(() => setRequestState('errored'));
  }, [api, query, cursor, organization, selection]);

  return [requestState, traces, pageLinks];
}

export {useProfiles};
