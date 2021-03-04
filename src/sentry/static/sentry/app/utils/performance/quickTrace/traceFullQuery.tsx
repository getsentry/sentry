import React from 'react';

import GenericDiscoverQuery from 'app/utils/discover/genericDiscoverQuery';
import {
  TraceFull,
  TraceFullQueryChildrenProps,
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
  children: (props: TraceFullQueryChildrenProps) => React.ReactNode;
};

function EmptyTrace({children}: Pick<QueryProps, 'children'>) {
  return (
    <React.Fragment>
      {children({
        isLoading: false,
        error: null,
        trace: null,
        type: 'full',
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
      {({tableData, ...rest}) =>
        children({
          // This is using '||` instead of '??` here because
          // the client returns a empty string when the response
          // is 204. And we want the empty string, undefined and
          // null to be converted to null.
          trace: tableData || null,
          type: 'full',
          ...rest,
        })
      }
    </GenericDiscoverQuery>
  );
}

export default withApi(TraceFullQuery);
