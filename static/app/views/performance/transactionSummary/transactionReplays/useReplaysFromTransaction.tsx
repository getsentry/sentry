import {useCallback, useEffect, useState} from 'react';
import {Location} from 'history';

import type {Client} from 'sentry/api';
import type {Organization} from 'sentry/types';
import {TableData} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {doDiscoverQuery} from 'sentry/utils/discover/genericDiscoverQuery';
import {decodeScalar} from 'sentry/utils/queryString';
import {
  DEFAULT_SORT,
  fetchReplayList,
  REPLAY_LIST_FIELDS,
} from 'sentry/utils/replays/hooks/useReplayList';

type State = Awaited<ReturnType<typeof fetchReplayList>>;
type Options = {
  api: Client;
  eventsWithReplaysView: EventView;
  location: Location;
  organization: Organization;
};
function useReplaysFromTransaction({
  api,
  eventsWithReplaysView,
  location,
  organization,
}: Options) {
  const [data, setData] = useState<State>({
    fetchError: undefined,
    isFetching: true,
    pageLinks: null,
    replays: [],
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
        orderby: decodeScalar(location.query.sort, DEFAULT_SORT),
      },
      location
    );
    const listData = await fetchReplayList({
      api,
      eventView,
      location,
      organization,
    });
    setData(listData);
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

    const replayIds = data.data.map(record => String(record.replayId));
    return replayIds;
  } catch (err) {
    return null;
  }
}

export default useReplaysFromTransaction;
