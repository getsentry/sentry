import {useEffect, useState} from 'react';

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

  const [data, setData] = useState<State>({
    fetchError: undefined,
    isFetching: true,
    pageLinks: null,
    replays: [],
  });

  useEffect(() => {
    fetchReplayList({
      api,
      organization,
      location,
      eventView,
    }).then(setData);
  }, [api, organization, location, eventView]);

  return data;
}

export default useReplayList;
