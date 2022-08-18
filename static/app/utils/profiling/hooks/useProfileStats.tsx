import {useEffect, useState} from 'react';
import * as Sentry from '@sentry/react';

import {Client} from 'sentry/api';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {t} from 'sentry/locale';
import {EventsStatsSeries, Organization, PageFilters, RequestState} from 'sentry/types';
import {defined} from 'sentry/utils';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

type ProfileStatsResult = EventsStatsSeries;

interface UseProfileStatsOptions {
  query: string;
  selection?: PageFilters;
}

export function useProfileStats({
  query,
  selection,
}: UseProfileStatsOptions): RequestState<ProfileStatsResult> {
  const api = useApi();
  const organization = useOrganization();

  const [requestState, setRequestState] = useState<RequestState<ProfileStatsResult>>({
    type: 'initial',
  });

  useEffect(() => {
    if (!defined(selection)) {
      return undefined;
    }

    setRequestState({type: 'loading'});

    fetchProfileStats(api, organization, {
      query,
      selection,
    })
      .then(result => {
        setRequestState({
          type: 'resolved',
          data: result,
        });
      })
      .catch(err => {
        setRequestState({
          type: 'errored',
          error: t('Error: Unable to load profile stats'),
        });
        Sentry.captureException(err);
      });

    return () => api.clear();
  }, [api, organization, query, selection]);

  return requestState;
}

function fetchProfileStats(
  api: Client,
  organization: Organization,
  {
    query,
    selection,
  }: {
    query: string;
    selection: PageFilters;
  }
) {
  return api.requestPromise(`/organizations/${organization.slug}/profiling/stats/`, {
    method: 'GET',
    includeAllArgs: false,
    query: {
      query,
      project: selection.projects,
      environment: selection.environments,
      ...normalizeDateTimeParams(selection.datetime),
    },
  });
}
