import {useCallback, useEffect, useState} from 'react';
import type {Location} from 'history';

import type {Organization} from 'sentry/types/organization';
import type EventView from 'sentry/utils/discover/eventView';
import fetchReplayList from 'sentry/utils/replays/fetchReplayList';
import useApi from 'sentry/utils/useApi';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {
  ReplayListLocationQuery,
  ReplayListQueryReferrer,
} from 'sentry/views/replays/types';

type Options = {
  eventView: EventView;
  location: Location<ReplayListLocationQuery>;
  organization: Organization;
  perPage?: number;
  queryReferrer?: ReplayListQueryReferrer;
};

type State = Awaited<ReturnType<typeof fetchReplayList>> & {isFetching: boolean};

type Result = State;

function useReplayList({
  eventView,
  location,
  organization,
  queryReferrer,
  perPage,
}: Options): Result {
  const api = useApi();
  const {selection} = usePageFilters();

  const [data, setData] = useState<State>({
    fetchError: undefined,
    isFetching: true,
    pageLinks: null,
    replays: [],
  });

  const loadReplays = useCallback(async () => {
    api.clear();
    setData(prev => ({
      ...prev,
      isFetching: true,
    }));
    const response = await fetchReplayList({
      api,
      organization,
      location,
      eventView,
      queryReferrer,
      perPage,
      selection,
    });

    setData({...response, isFetching: false});
  }, [api, organization, location, eventView, queryReferrer, perPage, selection]);

  useEffect(() => {
    loadReplays();
  }, [loadReplays]);

  return data;
}

export default useReplayList;
