import {useEffect, useMemo, useState} from 'react';
import first from 'lodash/first';

import fetchReplayClicks from 'sentry/utils/replays/fetchReplayClicks';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';

export type TimeOffsetLocationQueryParams = {
  /**
   * The time when the event happened.
   * Anything that can be parsed by `new Date()`; for example a timestamp in ms
   * or an ISO 8601 formatted string.
   */
  event_t?: string;

  /**
   * The query that was used on the index page. If it includes `click.*` fields
   * then we will use those to lookup a list of `offsetMs` values
   */
  query?: string;

  /**
   * A specific offset into the replay. Number of seconds.
   * Should be less than the duration of the replay
   */
  t?: string;
};

type Opts = {
  /**
   * The organization name you'll see in the browser url
   */
  orgSlug: string;
  /**
   * The project slug of the replayRecord
   */
  projectSlug: string | null;
  /**
   * The replayId
   */
  replayId: string;

  /**
   * The start timestamp of the replay.
   * Used to calculate the offset into the replay from an event timestamp
   */
  replayStartTimestampMs?: number;
};

function fromOffset({offsetSec}) {
  if (offsetSec === undefined) {
    // Not using this strategy
    return undefined;
  }

  return Number(offsetSec) * 1000;
}

function fromEventTimestamp({eventTimestamp, replayStartTimestampMs}) {
  if (eventTimestamp === undefined) {
    // Not using this strategy
    return undefined;
  }

  if (replayStartTimestampMs !== undefined) {
    const eventTimestampMs = new Date(eventTimestamp).getTime();
    if (eventTimestampMs >= replayStartTimestampMs) {
      return eventTimestampMs - replayStartTimestampMs;
    }
  }
  // The strategy failed, default to something safe
  return 0;
}

async function fromListPageQuery({
  api,
  listPageQuery,
  orgSlug,
  replayId,
  projectSlug,
  replayStartTimestampMs,
}) {
  if (listPageQuery === undefined) {
    // Not using this strategy
    return undefined;
  }

  // Check if there is even any `click.*` fields in the query string
  const search = new MutableSearch(listPageQuery);
  const isClickSearch = search.getFilterKeys().some(key => key.startsWith('click.'));
  if (!isClickSearch) {
    // There was a search, but not for clicks, so lets skip this strategy.
    return undefined;
  }

  if (replayStartTimestampMs === undefined) {
    // Using the strategy, but we must wait for replayStartTimestampMs to appear
    return 0;
  }

  if (!projectSlug) {
    return undefined;
  }

  const results = await fetchReplayClicks({
    api,
    orgSlug,
    projectSlug,
    replayId,
    query: listPageQuery,
  });
  if (!results.clicks.length) {
    return 0;
  }
  try {
    const firstTimestamp = first(results.clicks)!.timestamp;
    const firstTimestmpMs = new Date(firstTimestamp).getTime();
    return firstTimestmpMs - replayStartTimestampMs;
  } catch {
    return 0;
  }
}

function useInitialTimeOffsetMs({
  orgSlug,
  replayId,
  projectSlug,
  replayStartTimestampMs,
}: Opts) {
  const api = useApi();
  const {
    query: {event_t: eventTimestamp, query: listPageQuery, t: offsetSec},
  } = useLocation<TimeOffsetLocationQueryParams>();
  const [timestamp, setTimestamp] = useState<undefined | number>(undefined);

  // The different strategies for getting a time offset into the replay (what
  // time to start the replay at)
  // Each strategy should return time in milliseconds
  const offsetTimeMs = useMemo(() => fromOffset({offsetSec}), [offsetSec]);
  const eventTimeMs = useMemo(
    () => fromEventTimestamp({eventTimestamp, replayStartTimestampMs}),
    [eventTimestamp, replayStartTimestampMs]
  );
  const queryTimeMs = useMemo(
    () =>
      eventTimestamp === undefined
        ? fromListPageQuery({
            api,
            listPageQuery,
            orgSlug,
            replayId,
            projectSlug,
            replayStartTimestampMs,
          })
        : undefined,
    [
      api,
      eventTimestamp,
      listPageQuery,
      orgSlug,
      replayId,
      projectSlug,
      replayStartTimestampMs,
    ]
  );

  useEffect(() => {
    Promise.resolve(undefined)
      .then(definedOrDefault(offsetTimeMs))
      .then(definedOrDefault(eventTimeMs))
      .then(definedOrDefault(queryTimeMs))
      .then(definedOrDefault(0))
      .then(setTimestamp);
  }, [offsetTimeMs, eventTimeMs, queryTimeMs, projectSlug]);

  return timestamp;
}

function definedOrDefault<T>(dflt: T | undefined | Promise<T | undefined>) {
  return (val: T | undefined) => {
    return val ?? dflt;
  };
}

export default useInitialTimeOffsetMs;
