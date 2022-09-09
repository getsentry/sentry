import {useCallback, useEffect, useState} from 'react';
import {Location} from 'history';

import type {Client} from 'sentry/api';
import type {Organization} from 'sentry/types';
import {TableData} from 'sentry/utils/discover/discoverQuery';
import EventView, {fromSorts} from 'sentry/utils/discover/eventView';
import {doDiscoverQuery} from 'sentry/utils/discover/genericDiscoverQuery';
import {decodeScalar} from 'sentry/utils/queryString';
import fetchReplayList, {
  DEFAULT_SORT,
  REPLAY_LIST_FIELDS,
} from 'sentry/utils/replays/fetchReplayList';
import useApi from 'sentry/utils/useApi';

type State = Awaited<ReturnType<typeof fetchReplayList>> & {
  eventView: undefined | EventView;
};

type Options = {
  eventsWithReplaysView: EventView;
  location: Location;
  organization: Organization;
};

function useReplaysFromTransaction({
  eventsWithReplaysView,
  location,
  organization,
}: Options) {
  const api = useApi();
  const [data, setData] = useState<State>({
    fetchError: undefined,
    isFetching: true,
    pageLinks: null,
    replays: [],
    eventView: undefined,
  });

  const load = useCallback(async () => {
    const replayIds = await fetchReplayIds({
      api,
      eventView: eventsWithReplaysView,
      location,
      organization,
    });
    const eventView = EventView.fromNewQueryWithLocation(
      {
        id: '',
        name: 'Replays within a transaction',
        version: 2,
        fields: REPLAY_LIST_FIELDS,
        projects: [],
        query: `id:[${String(replayIds)}]`,
      },
      location
    );
    eventView.sorts = fromSorts(decodeScalar(location.query.sort, DEFAULT_SORT));
    const listData = await fetchReplayList({
      api,
      eventView,
      location,
      organization,
    });
    setData({
      ...listData,
      eventView,
    });
  }, [api, eventsWithReplaysView, location, organization]);

  useEffect(() => {
    load();
  }, [load]);

  return data;
}

async function fetchReplayIds({
  api,
  eventView,
  location,
  organization,
}: {
  api: Client;
  eventView: EventView;
  location: Location;
  organization: Organization;
}) {
  try {
    const [data] = await doDiscoverQuery<TableData>(
      api,
      `/organizations/${organization.slug}/events/`,
      eventView.getEventsAPIPayload(location)
    );

    return data.data.map(record => String(record.replayId));
  } catch (err) {
    return null;
  }
}

export default useReplaysFromTransaction;
