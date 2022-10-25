import {useCallback, useEffect, useState} from 'react';
import * as Sentry from '@sentry/react';
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
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useApi from 'sentry/utils/useApi';
import {ReplayListRecord} from 'sentry/views/replays/types';

export type ReplayListRecordWithTx = ReplayListRecord & {
  txEvent: {[x: string]: any};
};

import {SpanOperationBreakdownFilter} from '../filter';
import {
  EventsDisplayFilterName,
  getEventsFilterOptions,
  getPercentilesEventView,
  mapPercentileValues,
  PercentileValues,
} from '../transactionEvents/utils';

type State = Awaited<ReturnType<typeof fetchReplayList>> & {
  eventView: undefined | EventView;
  replays?: ReplayListRecordWithTx[];
};

type Options = {
  eventsDisplayFilterName: EventsDisplayFilterName;
  eventsWithReplaysView: EventView;
  location: Location;
  organization: Organization;
  spanOperationBreakdownFilter: SpanOperationBreakdownFilter;
};

function useReplaysFromTransaction({
  eventsWithReplaysView,
  location,
  organization,
  spanOperationBreakdownFilter,
  eventsDisplayFilterName,
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
    const percentilesView = getPercentilesEventView(eventsWithReplaysView.clone());
    const percentileData = await fetchPercentiles({
      api,
      eventView: percentilesView,
      location,
      organization,
    });
    const percentiles = mapPercentileValues(percentileData);
    const filteredEventView = getFilteredEventView({
      eventView: eventsWithReplaysView,
      percentiles,
      spanOperationBreakdownFilter,
      eventsDisplayFilterName,
    });

    const eventsData = await fetchEventsWithReplay({
      api,
      eventView: filteredEventView ?? eventsWithReplaysView,
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
  }, [
    api,
    eventsWithReplaysView,
    location,
    organization,
    spanOperationBreakdownFilter,
    eventsDisplayFilterName,
  ]);

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
    Sentry.captureException(err);
    return null;
  }
}

async function fetchPercentiles({
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

    return data.data[0];
  } catch (err) {
    Sentry.captureException(err);
    return null;
  }
}

function getFilteredEventView({
  percentiles,
  spanOperationBreakdownFilter,
  eventsDisplayFilterName,
  eventView,
}: {
  eventView: EventView;
  eventsDisplayFilterName: EventsDisplayFilterName;
  percentiles: PercentileValues;
  spanOperationBreakdownFilter: SpanOperationBreakdownFilter;
}) {
  const filter = getEventsFilterOptions(spanOperationBreakdownFilter, percentiles)[
    eventsDisplayFilterName
  ];
  const filteredEventView = eventView.clone();
  if (filteredEventView && filter?.query) {
    const query = new MutableSearch(filteredEventView.query);
    filter.query.forEach(item => query.setFilterValues(item[0], [item[1]]));
    filteredEventView.query = query.formatString();
  }
  return filteredEventView;
}

export default useReplaysFromTransaction;
