import {useCallback, useEffect, useState} from 'react';

import type {Organization} from 'sentry/types';
import type EventView from 'sentry/utils/discover/eventView';
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

  const [data, setData] = useState<State>({
    fetchError: undefined,
    isFetching: true,
    pageLinks: null,
    replays: [],
  });

  // The object usually contains the same values, but it's identity changes,
  // causing the list to re-render on pageload.
  // TODO(replay): Stringify then parse `location.query` to keep react-hooks happy.
  const query = JSON.stringify(location.query);

  const loadReplays = useCallback(async () => {
    setData(prev => ({
      ...prev,
      isFetching: true,
    }));
    const response = await fetchReplayList({
      api,
      eventView,
      organization,
      query: JSON.parse(query),
    });

    setData(response);
  }, [api, organization, query, eventView]);

  useEffect(() => {
    loadReplays();
  }, [loadReplays]);

  return data;
}

export default useReplayList;
