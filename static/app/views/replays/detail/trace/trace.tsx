import {useEffect, useState} from 'react';
import * as Sentry from '@sentry/react';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {getUtcDateString} from 'sentry/utils/dates';
import {TableData} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {doDiscoverQuery} from 'sentry/utils/discover/genericDiscoverQuery';
import {TraceFullDetailed} from 'sentry/utils/performance/quickTrace/types';
import {
  getTraceRequestPayload,
  makeEventView,
} from 'sentry/utils/performance/quickTrace/utils';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import TraceView from 'sentry/views/performance/traceDetails/traceView';
import type {ReplayListLocationQuery, ReplayRecord} from 'sentry/views/replays/types';

type State = {
  /**
   * Error, if not null.
   */
  // error: QueryError | null;
  error: any | null;
  /**
   * Loading state of this query.
   */
  isLoading: boolean;
  /**
   * Pagelinks, if applicable. Can be provided to the Pagination component.
   */
  pageLinks: string | null;
  /**
   * EventView that generates API payload
   */
  traceEventView: EventView | null;
  /**
   * Data / result.
   */
  traces: TraceFullDetailed[] | null;
};

interface Props {
  organization: Organization;
  replayRecord: ReplayRecord;
}

const INITIAL_STATE = Object.freeze({
  error: null,
  isLoading: true,
  pageLinks: null,
  traceEventView: null,
  traces: null,
});

export default function Trace({replayRecord, organization}: Props) {
  const [state, setState] = useState<State>(INITIAL_STATE);
  const api = useApi();
  const location = useLocation<ReplayListLocationQuery>();

  const replayId = replayRecord.id;
  const orgSlug = organization.slug;

  const start = getUtcDateString(replayRecord.startedAt.getTime());
  const end = getUtcDateString(replayRecord.finishedAt.getTime());

  useEffect(() => {
    async function loadTraces() {
      const eventView = EventView.fromSavedQuery({
        id: undefined,
        name: `Traces in replay ${replayId}`,
        fields: ['trace', 'count(trace)', 'min(timestamp)'],
        orderby: 'min_timestamp',
        query: `replayId:${replayId}`,
        projects: [ALL_ACCESS_PROJECTS],
        version: 2,

        start,
        end,
      });

      try {
        const [data, , resp] = await doDiscoverQuery<TableData>(
          api,
          `/organizations/${orgSlug}/events/`,
          eventView.getEventsAPIPayload(location)
        );

        const traceIds = data.data.map(({trace}) => trace).filter(trace => trace);

        // TODO(replays): Potential performance concerns here if number of traceIds is large
        const traceDetails = await Promise.allSettled(
          traceIds.map(traceId =>
            doDiscoverQuery(
              api,
              `/organizations/${orgSlug}/events-trace/${traceId}/`,
              getTraceRequestPayload({
                eventView: makeEventView({start, end}),
                location,
              })
            )
          )
        );

        const successfulTraceDetails = traceDetails
          .map(settled => (settled.status === 'fulfilled' ? settled.value[0] : undefined))
          .filter(Boolean);

        if (successfulTraceDetails.length !== traceDetails.length) {
          traceDetails.forEach(trace => {
            if (trace.status === 'rejected') {
              Sentry.captureMessage(trace.reason);
            }
          });
        }

        setState(prevState => ({
          isLoading: false,
          error: null,
          traceEventView: eventView,
          pageLinks: resp?.getResponseHeader('Link') ?? prevState.pageLinks,
          traces:
            successfulTraceDetails.flatMap(trace => trace as TraceFullDetailed[]) || [],
        }));
      } catch (err) {
        setState({
          isLoading: false,
          error: err,
          pageLinks: null,
          traceEventView: null,
          traces: null,
        });
      }
    }

    loadTraces();

    return () => {};
  }, [api, replayId, orgSlug, location, start, end]);

  if (state.isLoading) {
    return <LoadingIndicator />;
  }

  if (state.error || !state.traceEventView) {
    return <LoadingError />;
  }

  if (!state.traces?.length) {
    return (
      <EmptyStateWarning withIcon={false} small>
        {t('No traces found')}
      </EmptyStateWarning>
    );
  }

  return (
    <TraceView
      meta={null}
      traces={state.traces}
      location={location}
      organization={organization}
      traceEventView={state.traceEventView}
      traceSlug="Replay"
    />
  );
  // TODO(replays): pagination
}
