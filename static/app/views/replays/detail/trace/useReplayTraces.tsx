import {useCallback, useEffect, useMemo, useState} from 'react';
import type {Location} from 'history';

import {getTimeStampFromTableDateField, getUtcDateString} from 'sentry/utils/dates';
import type {TableData} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {doDiscoverQuery} from 'sentry/utils/discover/genericDiscoverQuery';
import type {ParsedHeader} from 'sentry/utils/parseLinkHeader';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import type {HydratedReplayRecord} from 'sentry/views/replays/types';

export type ReplayTrace = {
  timestamp: number | undefined;
  traceSlug: string;
};

type ReplayTraceDataResults = {
  eventView: EventView | undefined;
  indexComplete: boolean;
  indexError: undefined | Error;
  replayTraces: ReplayTrace[] | undefined;
};

// This hook fetches the traceIds and the min(timestamp) associated with each id, for a replay record.
export function useReplayTraces({
  replayRecord,
}: {
  replayRecord: HydratedReplayRecord | undefined;
}) {
  const api = useApi();
  const organization = useOrganization();

  const [state, setState] = useState<ReplayTraceDataResults>({
    indexComplete: false,
    indexError: undefined,
    replayTraces: undefined,
    eventView: undefined,
  });

  const orgSlug = organization.slug;

  // The replay timestamps have seconds precision, while the trace timestamps have milliseconds precision.
  // We fetch the traces with a 1 second buffer on either side of the replay timestamps to ensure we capture all
  // associated traces.
  const start = replayRecord
    ? getUtcDateString(replayRecord?.started_at.getTime() - 1000)
    : undefined;
  const end = replayRecord
    ? getUtcDateString(replayRecord?.finished_at.getTime() + 1000)
    : undefined;

  const listEventView = useMemo(() => {
    if (!replayRecord || !start || !end) {
      return null;
    }
    const replayId = replayRecord?.id;
    const projectId = replayRecord?.project_id;

    return EventView.fromSavedQuery({
      id: undefined,
      name: `Traces in replay ${replayId}`,
      fields: ['trace', 'min(timestamp)', 'max(transaction.duration)'],
      orderby: 'min_timestamp',
      query: `replayId:${replayId}`,
      projects: [Number(projectId)],
      version: 2,
      start,
      end,
    });
  }, [replayRecord, start, end]);

  const fetchTransactionData = useCallback(async () => {
    if (!listEventView || !start || !end) {
      return;
    }

    setState({
      indexComplete: false,
      indexError: undefined,
      replayTraces: undefined,
      eventView: listEventView,
    });

    let cursor = {
      cursor: '0:0:0',
      results: true,
      href: '',
    } as ParsedHeader;
    while (cursor.results) {
      const payload = {
        ...listEventView.getEventsAPIPayload({
          start,
          end,
          limit: 10,
        } as unknown as Location),
        sort: ['min_timestamp'],
        cursor: cursor.cursor,
      };

      try {
        const [{data}, , listResp] = await doDiscoverQuery<TableData>(
          api,
          `/organizations/${orgSlug}/events/`,
          payload
        );

        const parsedData = data
          .filter(row => row.trace) // Filter out items where trace is not truthy
          .sort((a, b) => {
            const aDuration = a['max(transaction.duration)'];
            const bDuration = b['max(transaction.duration)'];
            const aMinTimestamp = getTimeStampFromTableDateField(a['min(timestamp)']);
            const bMinTimestamp = getTimeStampFromTableDateField(b['min(timestamp)']);

            if (
              !aMinTimestamp ||
              !bMinTimestamp ||
              typeof aDuration !== 'number' ||
              typeof bDuration !== 'number'
            ) {
              return 0;
            }

            // We don't have a way to get the min start time of a trace, so we'll use the min timestamp and subtract the max duration
            // of a transaction in that trace, to make the best guess.
            const aMinStart = aMinTimestamp - aDuration / 1000;
            const bMinStart = bMinTimestamp - bDuration / 1000;

            return aMinStart - bMinStart;
          })
          .map(row => ({
            traceSlug: row.trace.toString(),
            timestamp: getTimeStampFromTableDateField(row['min(timestamp)']),
          }));

        const pageLinks = listResp?.getResponseHeader('Link') ?? null;
        cursor = parseLinkHeader(pageLinks)?.next!;
        const indexComplete = !cursor.results;
        setState(prev => ({
          ...prev,
          replayTraces: prev.replayTraces
            ? [...prev.replayTraces, ...parsedData]
            : parsedData,
          indexComplete,
        }));
      } catch (indexError) {
        setState(prev => ({
          ...prev,
          indexError: indexError as Error,
          indexComplete: true,
        }));
        cursor = {cursor: '', results: false, href: ''} as ParsedHeader;
      }
    }
  }, [api, listEventView, orgSlug, start, end]);

  useEffect(() => {
    if (state.indexComplete === false) {
      fetchTransactionData();
    }
  }, [fetchTransactionData, state.indexComplete]);

  return state;
}
