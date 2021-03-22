import React from 'react';

import GenericDiscoverQuery from 'app/utils/discover/genericDiscoverQuery';
import {
  TraceFull,
  TraceFullQueryChildrenProps,
  TraceRequestProps,
} from 'app/utils/performance/quickTrace/types';
import {
  beforeFetch,
  getQuickTraceRequestPayload,
  makeEventView,
} from 'app/utils/performance/quickTrace/utils';
import withApi from 'app/utils/withApi';

type QueryProps = Omit<TraceRequestProps, 'eventId' | 'eventView'> & {
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

function TraceFullQuery({
  traceId,
  start,
  end,
  statsPeriod,
  children,
  ...props
}: QueryProps) {
  if (!traceId) {
    return <EmptyTrace>{children}</EmptyTrace>;
  }

  const eventView = makeEventView({start, end, statsPeriod});

  return (
    <GenericDiscoverQuery<TraceFull, {}>
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
          // TODO(wmak): replace once the backend starts returning arrays
          // `(tableData || null)?.[0] ?? null,`
          trace: (tableData || null)?.[0] ?? (tableData || null),
          type: 'full',
          ...rest,
        })
      }
    </GenericDiscoverQuery>
  );
}

export default withApi(TraceFullQuery);
