import React from 'react';

import GenericDiscoverQuery from 'app/utils/discover/genericDiscoverQuery';
import {
  TraceLite,
  TraceLiteQueryChildrenProps,
  TraceProps,
  TraceRequestProps,
} from 'app/utils/performance/quickTrace/types';
import {
  beforeFetch,
  getQuickTraceRequestPayload,
  isTransaction,
  makeEventView,
} from 'app/utils/performance/quickTrace/utils';
import withApi from 'app/utils/withApi';

type QueryProps = Omit<TraceRequestProps, 'eventView'> & {
  children: (props: TraceLiteQueryChildrenProps) => React.ReactNode;
};

function getQuickTraceLiteRequestPayload({event, ...props}: TraceRequestProps) {
  const additionalApiPayload = getQuickTraceRequestPayload(props);
  return Object.assign({event_id: event.id}, additionalApiPayload);
}

function EmptyTrace({children}: Pick<QueryProps, 'children'>) {
  return (
    <React.Fragment>
      {children({
        isLoading: false,
        error: null,
        trace: null,
        type: 'empty',
      })}
    </React.Fragment>
  );
}

function TraceLiteQuery({event, children, ...props}: QueryProps) {
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
    <GenericDiscoverQuery<TraceLite, TraceProps>
      event={event}
      route={`events-trace-light/${traceId}`}
      getRequestPayload={getQuickTraceLiteRequestPayload}
      beforeFetch={beforeFetch}
      eventView={eventView}
      {...props}
    >
      {({tableData, ...rest}) =>
        children({
          // This is using '||` instead of '??` here because
          // the client returns a empty string when the response
          // is 204. And we want the empty string, undefined and
          // null to be converted to null.
          trace: tableData || null,
          type: 'partial',
          ...rest,
        })
      }
    </GenericDiscoverQuery>
  );
}

export default withApi(TraceLiteQuery);
