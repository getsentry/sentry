import {useEffect, useMemo, useState} from 'react';
import type {Query} from 'history';

import type {Client} from 'sentry/api';
import isValidDate from 'sentry/utils/date/isValidDate';
import {decodeScalar} from 'sentry/utils/queryString';
import fetchReplayClicks from 'sentry/utils/replays/fetchReplayClicks';
import type {highlightNode} from 'sentry/utils/replays/highlightNode';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';

export type TimeOffsetLocationQueryParams = {
  /**
   * The time when the event happened.
   * Anything that can be parsed by `new Date()`; for example a timestamp in ms
   * or an ISO 8601 formatted string.
   */
  event_t?: Query[string];

  /**
   * The query that was used on the index page. If it includes `click.*` fields
   * then we will use those to lookup a list of `offsetMs` values
   */
  query?: Query[string];

  /**
   * A specific offset into the replay. Number of seconds.
   * Should be less than the duration of the replay
   */
  t?: Query[string];
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

type Result =
  | undefined
  | {
      offsetMs: number;
      highlight?: Parameters<typeof highlightNode>[1];
    };

const ZERO_OFFSET = {offsetMs: 0};

function fromOffset({offsetSec}: {offsetSec: Query[string]}): Result {
  if (offsetSec === undefined) {
    // Not using this strategy
    return undefined;
  }

  return {offsetMs: Number(offsetSec) * 1000};
}

function fromEventTimestamp({
  eventTimestamp,
  replayStartTimestampMs,
}: {
  eventTimestamp: Query[string];
  replayStartTimestampMs: Opts['replayStartTimestampMs'];
}): Result {
  if (eventTimestamp === undefined || eventTimestamp === null) {
    // Not using this strategy
    return undefined;
  }

  if (replayStartTimestampMs !== undefined && replayStartTimestampMs !== null) {
    let date = new Date(decodeScalar(eventTimestamp, ''));
    if (!isValidDate(date)) {
      const asInt = parseInt(decodeScalar(eventTimestamp, ''), 10);
      // Allow input to be `?event_t=$num_of_seconds` or `?event_t=$num_of_miliseconds`
      date = asInt < 9999999999 ? new Date(asInt * 1000) : new Date(asInt);
    }
    const eventTimestampMs = date.getTime();
    if (eventTimestampMs >= replayStartTimestampMs) {
      return {offsetMs: eventTimestampMs - replayStartTimestampMs};
    }
  }
  // The strategy failed, default to something safe
  return ZERO_OFFSET;
}

async function fromListPageQuery({
  api,
  listPageQuery,
  orgSlug,
  replayId,
  projectSlug,
  replayStartTimestampMs,
}: Opts & {api: Client; listPageQuery: Query[string]}): Promise<Result> {
  if (listPageQuery === undefined || listPageQuery === null) {
    // Not using this strategy
    return undefined;
  }

  // Check if there is even any `click.*` fields in the query string
  const search = new MutableSearch(decodeScalar(listPageQuery, ''));
  const isClickSearch = search
    .getFilterKeys()
    .some(
      key =>
        key.startsWith('click.') || key.startsWith('rage.') || key.startsWith('dead.')
    );
  if (!isClickSearch) {
    // There was a search, but not for clicks, so lets skip this strategy.
    return undefined;
  }

  if (replayStartTimestampMs === undefined) {
    // Using the strategy, but we must wait for replayStartTimestampMs to appear
    return ZERO_OFFSET;
  }

  if (!projectSlug) {
    return undefined;
  }

  const results = await fetchReplayClicks({
    api,
    orgSlug,
    projectSlug,
    replayId,
    query: decodeScalar(listPageQuery, ''),
  });

  if (!results.clicks.length) {
    return ZERO_OFFSET;
  }
  try {
    const firstResult = results.clicks.at(0)!;
    const firstTimestamp = firstResult.timestamp;
    const nodeId = firstResult.node_id;
    const firstTimestmpMs = new Date(firstTimestamp).getTime();
    return {
      highlight: {
        annotation: undefined,
        nodeIds: [nodeId],
        spotlight: true,
      },
      offsetMs: firstTimestmpMs - replayStartTimestampMs,
    };
  } catch {
    return ZERO_OFFSET;
  }
}

export default function useInitialTimeOffsetMs({
  orgSlug,
  replayId,
  projectSlug,
  replayStartTimestampMs,
}: Opts): Result {
  const api = useApi();
  const {
    query: {event_t: eventTimestamp, query: listPageQuery, t: offsetSec},
  } = useLocation<TimeOffsetLocationQueryParams>();
  const [timestamp, setTimestamp] = useState<Result>(undefined);

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
      eventTimestamp === undefined || eventTimestamp === null
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
      .then(definedOrDefault(ZERO_OFFSET))
      .then(setTimestamp);
  }, [offsetTimeMs, eventTimeMs, queryTimeMs, projectSlug]);

  return timestamp;
}

function definedOrDefault<T>(dflt: T | undefined | Promise<T | undefined>) {
  return (val: T | undefined) => {
    return val ?? dflt;
  };
}
