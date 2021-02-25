import React from 'react';
import omit from 'lodash/omit';

import {Client} from 'app/api';
import {getTraceDateTimeRange} from 'app/components/events/interfaces/spans/utils';
import {ALL_ACCESS_PROJECTS} from 'app/constants/globalSelectionHeader';
import {EventTransaction} from 'app/types/event';
import EventView from 'app/utils/discover/eventView';
import GenericDiscoverQuery, {
  DiscoverQueryProps,
} from 'app/utils/discover/genericDiscoverQuery';
import {
  TraceFull,
  TraceFullQueryChildrenProps,
  TraceProps,
} from 'app/utils/performance/quickTrace/types';
import {isTransaction} from 'app/utils/performance/quickTrace/utils';
import withApi from 'app/utils/withApi';

type RequestProps = DiscoverQueryProps & TraceProps;

type QueryProps = Omit<RequestProps, 'eventView'> & {
  children: (props: TraceFullQueryChildrenProps) => React.ReactNode;
};

function getQuickTraceRequestPayload({eventView, location}: RequestProps) {
  return omit(eventView.getEventsAPIPayload(location), ['field', 'sort', 'per_page']);
}

function beforeFetch(api: Client) {
  api.clear();
}

function makeEventView(event: EventTransaction) {
  const {start, end} = getTraceDateTimeRange({
    start: event.startTimestamp,
    end: event.endTimestamp,
  });

  return EventView.fromSavedQuery({
    id: undefined,
    version: 2,
    name: '',
    // This field doesn't actually do anything,
    // just here to satify a constraint in EventView.
    fields: ['transaction.duration'],
    projects: [ALL_ACCESS_PROJECTS],
    query: '',
    environment: [],
    range: '',
    start,
    end,
  });
}

function EmptyTrace({children}: Pick<QueryProps, 'children'>) {
  return (
    <React.Fragment>
      {children({
        isLoading: true,
        error: null,
        trace: null,
      })}
    </React.Fragment>
  );
}

function TraceFullQuery({event, children, ...props}: QueryProps) {
  // non transaction events are currently unsupported
  if (!isTransaction(event)) {
    return <EmptyTrace>{children}</EmptyTrace>;
  }

  const traceId = event.contexts?.trace?.trace_id;
  if (!traceId) {
    return <EmptyTrace>{children}</EmptyTrace>;
  }

  const eventView = makeEventView(event);

  return (
    <GenericDiscoverQuery<TraceFull, TraceProps>
      event={event}
      route={`events-trace/${traceId}`}
      getRequestPayload={getQuickTraceRequestPayload}
      beforeFetch={beforeFetch}
      eventView={eventView}
      {...props}
    >
      {({tableData, ...rest}) => children({trace: tableData ?? null, ...rest})}
    </GenericDiscoverQuery>
  );
}

export default withApi(TraceFullQuery);
