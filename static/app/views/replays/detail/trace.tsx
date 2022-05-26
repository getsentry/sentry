import {useEffect, useState} from 'react';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import type {EventTransaction} from 'sentry/types/event';
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
import {useRouteContext} from 'sentry/utils/useRouteContext';
import TraceView from 'sentry/views/performance/traceDetails/traceView';

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
  event: EventTransaction;
  organization: Organization;
}

const INITIAL_STATE = Object.freeze({
  error: null,
  isLoading: true,
  pageLinks: null,
  traceEventView: null,
  traces: null,
});

export default function Trace({event, organization}: Props) {
  const [state, setState] = useState<State>(INITIAL_STATE);
  const api = useApi();

  const {
    location,
    params: {eventSlug, orgId},
  } = useRouteContext();
  const [, eventId] = eventSlug.split(':');

  useEffect(() => {
    async function loadTraces() {
      const start = getUtcDateString(event.startTimestamp * 1000);
      const end = getUtcDateString(event.endTimestamp * 1000);

      const eventView = EventView.fromSavedQuery({
        id: undefined,
        name: `Traces in replay ${eventId}`,
        fields: ['trace', 'count(trace)', 'min(timestamp)'],
        orderby: 'min_timestamp',
        query: `replayId:${eventId} !transaction:"sentry-replay-event"`,
        projects: [ALL_ACCESS_PROJECTS],
        version: 2,

        start,
        end,
      });

      try {
        const [data, , resp] = await doDiscoverQuery<TableData>(
          api,
          `/organizations/${orgId}/eventsv2/`,
          eventView.getEventsAPIPayload(location)
        );

        const traceIds = data.data.map(({trace}) => trace);

        // TODO(replays): Potential performance concerns here if number of traceIds is large
        const traceDetails = await Promise.all(
          traceIds.map(traceId =>
            doDiscoverQuery(
              api,
              `/organizations/${orgId}/events-trace/${traceId}/`,
              getTraceRequestPayload({
                eventView: makeEventView({start, end}),
                location,
              })
            )
          )
        );

        setState(prevState => ({
          isLoading: false,
          error: null,
          traceEventView: eventView,
          pageLinks: resp?.getResponseHeader('Link') ?? prevState.pageLinks,
          traces: traceDetails.flatMap(([trace]) => trace as TraceFullDetailed[]) || [],
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
  }, [api, eventId, orgId, location, event.startTimestamp, event.endTimestamp]);

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
