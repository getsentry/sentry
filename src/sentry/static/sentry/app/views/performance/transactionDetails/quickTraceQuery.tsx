import React from 'react';
import omit from 'lodash/omit';

import {Client} from 'app/api';
import {getTraceDateTimeRange} from 'app/components/events/interfaces/spans/utils';
import {ALL_ACCESS_PROJECTS} from 'app/constants/globalSelectionHeader';
import {Event, EventTransaction} from 'app/types/event';
import EventView from 'app/utils/discover/eventView';
import GenericDiscoverQuery, {
  DiscoverQueryProps,
  GenericChildrenProps,
} from 'app/utils/discover/genericDiscoverQuery';
import withApi from 'app/utils/withApi';

import {isTransaction} from './utils';

export type EventLite = {
  event_id: string;
  span_id: string;
  transaction: string;
  project_id: number;
  parent_event_id: string | null;
  is_root: boolean;
};

export type TraceLite = EventLite[];

type QuickTraceProps = {
  event: Event;
};

type RequestProps = DiscoverQueryProps & QuickTraceProps;

type ChildrenProps = Omit<GenericChildrenProps<QuickTraceProps>, 'tableData'> & {
  trace: TraceLite | null;
};

type QueryProps = Omit<RequestProps, 'eventView'> & {
  children: (props: ChildrenProps) => React.ReactNode;
};

function getQuickTraceRequestPayload({eventView, event, location}: RequestProps) {
  const additionalApiPayload = omit(eventView.getEventsAPIPayload(location), [
    'field',
    'sort',
    'per_page',
  ]);
  return Object.assign({event_id: event.id}, additionalApiPayload);
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
        pageLinks: null,
        trace: null,
      })}
    </React.Fragment>
  );
}

function QuickTraceQuery({event, children, ...props}: QueryProps) {
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
    <GenericDiscoverQuery<TraceLite, QuickTraceProps>
      event={event}
      route={`events-trace-light/${traceId}`}
      getRequestPayload={getQuickTraceRequestPayload}
      beforeFetch={beforeFetch}
      eventView={eventView}
      {...props}
    >
      {({tableData, ...rest}) => children({trace: tableData ?? null, ...rest})}
    </GenericDiscoverQuery>
  );
}

export default withApi(QuickTraceQuery);
