import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {hashQueryKey} from '@tanstack/react-query';
import {Location} from 'history';
import sortBy from 'lodash/sortBy';

import {getUtcDateString} from 'sentry/utils/dates';
import type {TableData} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {doDiscoverQuery} from 'sentry/utils/discover/genericDiscoverQuery';
import parseLinkHeader, {ParsedHeader} from 'sentry/utils/parseLinkHeader';
import {TraceFullDetailed} from 'sentry/utils/performance/quickTrace/types';
import {
  getTraceRequestPayload,
  makeEventView,
} from 'sentry/utils/performance/quickTrace/utils';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import type {ReplayRecord} from 'sentry/views/replays/types';

type Options = {
  children: ReactNode;
  replayRecord: undefined | ReplayRecord;
};

type InternalState = {
  detailsErrors: Error[];
  detailsRequests: number;
  detailsResponses: number;
  indexComplete: boolean;
  indexError: undefined | Error;
  isFetching: boolean;
  traces: undefined | TraceFullDetailed[];
};

type ExternalState = {
  errors: Error[];
  isFetching: boolean;
  traces: undefined | TraceFullDetailed[];
};

const INITIAL_STATE: InternalState = {
  detailsErrors: [],
  detailsRequests: 0,
  detailsResponses: 0,
  indexComplete: true,
  indexError: undefined,
  isFetching: false,
  traces: undefined,
};

type TxnContextProps = {
  eventView: null | EventView;
  fetchTransactionData: () => void;
  state: ExternalState;
};

const TxnContext = createContext<TxnContextProps>({
  eventView: null,
  fetchTransactionData: () => {},
  state: {errors: [], isFetching: false, traces: []},
});

const cache = new Map();

async function doDiscoverQueryWithCache<T>(
  ...args: Parameters<typeof doDiscoverQuery<T>>
) {
  const [, url, payload] = args;
  const cacheKey = hashQueryKey([url, payload]);
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }
  const result = await doDiscoverQuery(...args);
  cache.set(cacheKey, result);
  return result;
}

function ReplayTransactionContext({children, replayRecord}: Options) {
  const api = useApi();
  const location = useLocation();
  const organization = useOrganization();

  const [state, setState] = useState<InternalState>(INITIAL_STATE);

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

  const tracePayload = useMemo(() => {
    const start = getUtcDateString(replayRecord?.started_at.getTime());
    const end = getUtcDateString(replayRecord?.finished_at.getTime());

    const traceEventView = makeEventView({start, end});
    return getTraceRequestPayload({eventView: traceEventView, location});
  }, [replayRecord, location]);

  const fetchSingleTraceData = useCallback(
    async traceId => {
      try {
        const [trace, , _traceResp] = await doDiscoverQueryWithCache(
          api,
          `/organizations/${orgSlug}/events-trace/${traceId}/`,
          tracePayload
        );

        setState(prev => ({
          ...prev,
          traces: sortBy(
            (prev.traces || []).concat(trace as TraceFullDetailed),
            'start_timestamp'
          ),
        }));
      } catch (error) {
        setState(prev => ({
          ...prev,
          detailsErrors: prev.detailsErrors.concat(error),
        }));
      }
    },
    [api, orgSlug, tracePayload]
  );

  const fetchTransactionData = useCallback(async () => {
    if (!listEventView) {
      return;
    }
    const start = getUtcDateString(replayRecord?.started_at.getTime());
    const end = getUtcDateString(replayRecord?.finished_at.getTime());

    setState({
      detailsErrors: [],
      detailsRequests: 0,
      detailsResponses: 0,
      indexComplete: false,
      indexError: undefined,
      isFetching: true,
      traces: [],
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
        const [{data}, , listResp] = await doDiscoverQueryWithCache<TableData>(
          api,
          `/organizations/${orgSlug}/events/`,
          payload
        );

        const traceIds = data.map(({trace}) => String(trace)).filter(Boolean);

        // Do not await results here. Do the fetches async and let the loop continue
        (async function () {
          setState(
            prev =>
              ({
                ...prev,
                detailsRequests: prev.detailsRequests + traceIds.length,
              } as InternalState)
          );
          await Promise.allSettled(traceIds.map(fetchSingleTraceData));
          setState(
            prev =>
              ({
                ...prev,
                detailsResponses: prev.detailsResponses + traceIds.length,
              } as InternalState)
          );
        })();

        const pageLinks = listResp?.getResponseHeader('Link') ?? null;
        cursor = parseLinkHeader(pageLinks)?.next;
      } catch (indexError) {
        setState(prev => ({...prev, indexError} as InternalState));
        cursor = {cursor: '', results: false, href: ''} as ParsedHeader;
      }
    }

    setState(prev => ({...prev, indexComplete: true} as InternalState));
  }, [api, fetchSingleTraceData, listEventView, orgSlug, replayRecord]);

  return (
    <TxnContext.Provider
      value={{
        eventView: listEventView,
        fetchTransactionData,
        state: internalToExternalState(state),
      }}
    >
      {children}
    </TxnContext.Provider>
  );
}

function internalToExternalState({
  detailsErrors,
  detailsRequests,
  detailsResponses,
  indexComplete,
  indexError,
  traces,
}: InternalState): ExternalState {
  const isComplete = indexComplete && detailsRequests === detailsResponses;

  return {
    errors: indexError ? [indexError] : detailsErrors,
    isFetching: !isComplete,
    traces,
  };
}

export default ReplayTransactionContext;

export const useFetchTransactions = () => {
  const {fetchTransactionData} = useContext(TxnContext);

  useEffect(fetchTransactionData, [fetchTransactionData]);
};

export const useTransactionData = () => {
  const {eventView, state} = useContext(TxnContext);
  const data = useMemo(() => ({eventView, state}), [eventView, state]);
  return data;
};
