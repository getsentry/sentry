import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import sortBy from 'lodash/sortBy';

import {getUtcDateString} from 'sentry/utils/dates';
import type {TableData} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {doDiscoverQuery} from 'sentry/utils/discover/genericDiscoverQuery';
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
  error: null | Error;
  isFetching: boolean;
  requests: number;
  responses: number;
  traces: undefined | TraceFullDetailed[];
};

const INITIAL_STATE: State = {
  error: null,
  isFetching: false,
  requests: 0,
  responses: 0,
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

  const fetchTransactionData = useCallback(async () => {
    if (state.traces) {
      return;
    }

    setState({
      error: null,
      isFetching: true,
      requests: 0,
      responses: 0,
      traces: [],
    });

    const [{data}, , _listResp] = await doDiscoverQuery<TableData>(
      api,
      `/organizations/${orgSlug}/events/`,
      listEventView.getEventsAPIPayload(location)
    );

    // TODO: need to iterate over all pages of data
    const traceIds = data.map(({trace}) => trace).filter(trace => trace);

    setState(prev => ({
      ...prev,
      requests: traceIds.length,
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
            responses: prev.responses + 1,
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
      error: null,
      isFetching: false,
    }));
  }, [api, listEventView, location, orgSlug, state, tracePayload]);

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
