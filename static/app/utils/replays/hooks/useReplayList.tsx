import {useCallback, useEffect, useRef, useState} from 'react';

import type {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import fetchReplayList from 'sentry/utils/replays/fetchReplayList';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import type {ReplayListLocationQuery} from 'sentry/views/replays/types';

type Options = {
  eventView: EventView;
  organization: Organization;
};

type State = Awaited<ReturnType<typeof fetchReplayList>>;

type Result = State;

function useReplayList({eventView, organization}: Options): Result {
  const api = useApi();
  const location = useLocation<ReplayListLocationQuery>();
  const querySearchRef = useRef<string>();

  const [data, setData] = useState<State>({
    fetchError: undefined,
    isFetching: true,
    pageLinks: null,
    replays: [],
  });

  const handleFetch = useCallback(async () => {
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
    setData(response);
  }, [api, organization, location, eventView]);

  useEffect(() => {
    if (!querySearchRef.current || querySearchRef.current !== location.search) {
      querySearchRef.current = location.search;
      handleFetch();
    }
  }, [handleFetch, location.search]);

  return data;
}

export default useReplayList;
