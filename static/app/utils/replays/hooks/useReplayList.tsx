import {useCallback, useEffect, useState} from 'react';
import {Location} from 'history';

import type {Organization} from 'sentry/types';
import type EventView from 'sentry/utils/discover/eventView';
import fetchReplayList from 'sentry/utils/replays/fetchReplayList';
import useApi from 'sentry/utils/useApi';
import type {ReplayListLocationQuery} from 'sentry/views/replays/types';

type Options = {
  eventView: EventView;
  location: Location<ReplayListLocationQuery>;
  organization: Organization;
};

type State = Awaited<ReturnType<typeof fetchReplayList>> & {isFetching: boolean};

type Result = State;

function useReplayList({eventView, location, organization}: Options): Result {
  const api = useApi();

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
    });

    setData({...response, isFetching: false});
  }, [api, organization, location, eventView]);

  useEffect(() => {
    loadReplays();
  }, [loadReplays]);

  return data;
}

export default useReplayList;
