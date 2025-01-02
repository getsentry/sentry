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
import type {ReplayRecord} from 'sentry/views/replays/types';

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
  replayRecord: ReplayRecord | undefined;
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

  const listEventView = useMemo(() => {
    if (!replayRecord) {
      return null;
    }
    const replayId = replayRecord?.id;
    const projectId = replayRecord?.project_id;
    const start = getUtcDateString(replayRecord?.started_at.getTime());
    const end = getUtcDateString(replayRecord?.finished_at.getTime());

    return EventView.fromSavedQuery({
      id: undefined,
      name: `Traces in replay ${replayId}`,
      fields: ['trace', 'count(trace)', 'min(timestamp)'],
      orderby: 'min_timestamp',
      query: `replayId:${replayId}`,
      projects: [Number(projectId)],
      version: 2,
      start,
      end,
    });
  }, [replayRecord]);

  const fetchTransactionData = useCallback(async () => {
    if (!listEventView) {
      return;
    }
    const start = getUtcDateString(replayRecord?.started_at.getTime());
    const end = getUtcDateString(replayRecord?.finished_at.getTime());

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
        sort: ['min_timestamp', 'trace'],
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
          .map(row => ({
            traceSlug: row.trace!.toString(),
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
        setState(prev => ({...prev, indexError, indexComplete: true}));
        cursor = {cursor: '', results: false, href: ''} as ParsedHeader;
      }
    }
  }, [api, listEventView, orgSlug, replayRecord]);

  useEffect(() => {
    if (state.indexComplete === false) {
      fetchTransactionData();
    }
  }, [fetchTransactionData, state.indexComplete]);

  return state;
}
