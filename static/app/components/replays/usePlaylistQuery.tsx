import type {Query} from 'history';

import {parseStatsPeriod} from 'sentry/components/timeRangeSelector/utils';
import EventView from 'sentry/utils/discover/eventView';
import {useLocation} from 'sentry/utils/useLocation';
import type {ReplayListQueryReferrer} from 'sentry/views/replays/types';

export function usePlaylistQuery(
  referrer: ReplayListQueryReferrer,
  eventView?: EventView
): Query {
  const location = useLocation();
  if (!eventView) {
    eventView = EventView.fromLocation(location);
  }

  const {statsPeriod, start, end, query, project, environment} =
    eventView.generateQueryStringObject();

  const eventViewQuery: Query = {
    query,
    referrer,
    project,
    environment,
  };

  if (typeof statsPeriod === 'string') {
    const {start: playlistStart, end: playlistEnd} = parseStatsPeriod(
      statsPeriod,
      undefined,
      true
    );
    eventViewQuery.playlistStart = playlistStart;
    eventViewQuery.playlistEnd = playlistEnd;
  } else if (start && end) {
    eventViewQuery.playlistStart = start;
    eventViewQuery.playlistEnd = end;
  }

  // Because the sort and cursor field is only generated in EventView conditionally and we
  // want to avoid dirtying the URL with fields, we manually add them to the query here.
  if (location.query.sort) {
    eventViewQuery.playlistSort = location.query.sort;
  }
  if (location.query.cursor) {
    eventViewQuery.cursor = location.query.cursor;
  }
  eventViewQuery.referrer = referrer;
  return eventViewQuery;
}
