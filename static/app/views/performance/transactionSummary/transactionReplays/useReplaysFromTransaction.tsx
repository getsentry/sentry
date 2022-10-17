import {useCallback, useEffect, useState} from 'react';
import {Location} from 'history';

import type {Client} from 'sentry/api';
import type {Organization} from 'sentry/types';
import {TableData, TableDataRow} from 'sentry/utils/discover/discoverQuery';
import EventView, {fromSorts} from 'sentry/utils/discover/eventView';
import {doDiscoverQuery} from 'sentry/utils/discover/genericDiscoverQuery';
import {decodeScalar} from 'sentry/utils/queryString';
import fetchReplayList, {
  DEFAULT_SORT,
  REPLAY_LIST_FIELDS,
} from 'sentry/utils/replays/fetchReplayList';
import useApi from 'sentry/utils/useApi';
import {ReplayListRecord} from 'sentry/views/replays/types';

export type ReplayListRecordWithTx = ReplayListRecord & {
  txEvent: {[x: string]: any};
};

type State = Awaited<ReturnType<typeof fetchReplayList>> & {
  eventView: undefined | EventView;
  replays?: ReplayListRecordWithTx[];
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
    const eventsData = await fetchEventsWithReplay({
      api,
      eventView: eventsWithReplaysView,
      location,
      organization,
    });

    const replayIds = eventsData?.map(row => row.replayId);

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

    const replays: ReplayListRecordWithTx[] | undefined = listData.replays?.map(
      replay => {
        let slowestEvent: TableDataRow | undefined;
        for (const event of eventsData ?? []) {
          // attach the slowest tx event to the replay
          if (
            event.replayId === replay.id &&
            (!slowestEvent ||
              event['transaction.duration'] > slowestEvent['transaction.duration'])
          ) {
            slowestEvent = event;
          }
        }

        return {
          ...replay,
          txEvent: slowestEvent ?? {},
        };
      }
    );

    setData({
      ...listData,
      eventView,
      replays,
    });
  }, [api, eventsWithReplaysView, location, organization]);

  useEffect(() => {
    load();
  }, [load]);

  return data;
}

async function fetchEventsWithReplay({
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

    return data.data;
  } catch (err) {
    return null;
  }
}

export default useReplaysFromTransaction;
