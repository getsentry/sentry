import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
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

type State = {
  detailsComplete: boolean;
  detailsRequests: number;
  detailsResponses: number;
  error: null | Error;
  indexComplete: boolean;
  isFetching: boolean;
  traces: undefined | TraceFullDetailed[];
};

const INITIAL_STATE: State = {
  detailsComplete: true,
  detailsRequests: 0,
  detailsResponses: 0,
  error: null,
  indexComplete: true,
  isFetching: false,
  traces: undefined,
};

type TxnContextProps = {
  eventView: null | EventView;
  fetchTransactionData: () => void;
  state: State;
};
const TxnContext = createContext<TxnContextProps>({
  eventView: null,
  fetchTransactionData: () => {},
  state: INITIAL_STATE,
});

function ReplayTransactionContext({children, replayRecord}: Options) {
  const api = useApi();
  const location = useLocation();
  const organization = useOrganization();

  const [state, setState] = useState<State>(INITIAL_STATE);

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

  const fetchTraceIdData = useCallback(
    async (traceIds: string[]) => {
      setState(prev => ({
        ...prev,
        detailsRequests: prev.detailsRequests + traceIds.length,
      }));

      await Promise.allSettled(
        traceIds.map(traceId => {
          const promise = doDiscoverQuery(
            api,
            `/organizations/${orgSlug}/events-trace/${traceId}/`,
            tracePayload
          );
          promise.then(([trace, , _traceResp]) => {
            // TODO: we need to iterate over any pages of data
            setState(prev => ({
              ...prev,
              detailsResponses: prev.detailsResponses + 1,
              traces: sortBy(
                (prev.traces || []).concat(trace as TraceFullDetailed),
                'start_timestamp'
              ),
            }));
          });
          return promise;
        })
      );

      setState(prev => ({
        ...prev,
        detailsComplete: prev.detailsRequests === prev.detailsResponses,
      }));
    },
    [api, orgSlug, tracePayload]
  );

  const fetchTransactionData = useCallback(async () => {
    if (state.traces || !listEventView) {
      return;
    }
    const start = getUtcDateString(replayRecord?.started_at.getTime());
    const end = getUtcDateString(replayRecord?.finished_at.getTime());

    setState({
      error: null,
      isFetching: true,
      indexComplete: false,
      detailsRequests: 0,
      detailsResponses: 0,
      detailsComplete: false,
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
        cursor: cursor.cursor,
      };

      const [{data}, , listResp] = await doDiscoverQuery<TableData>(
        api,
        `/organizations/${orgSlug}/events/`,
        payload
      );

      const traceIds = data.map(({trace}) => String(trace)).filter(trace => trace);

      // Do not await this, send off the requests and keep working on the while-loop here
      fetchTraceIdData(traceIds);

      const pageLinks = listResp?.getResponseHeader('Link') ?? null;
      cursor = parseLinkHeader(pageLinks)?.next;
    }

    setState(prev => ({
      ...prev,
      indexComplete: true,
      error: null,
    }));
  }, [api, fetchTraceIdData, listEventView, orgSlug, replayRecord, state]);

  return (
    <TxnContext.Provider value={{eventView: listEventView, fetchTransactionData, state}}>
      {children}
    </TxnContext.Provider>
  );
}

export default ReplayTransactionContext;

export const useTransactionData = () => {
  const context = useContext(TxnContext);
  useEffect(() => {
    context.fetchTransactionData();
  }, [context]);

  return {
    state: context.state,
    eventView: context.eventView,
  };
};
