import React from 'react';

import GenericDiscoverQuery, {
  DiscoverQueryProps,
} from 'app/utils/discover/genericDiscoverQuery';
import {
  BaseTraceChildrenProps,
  PartialQuickTrace,
  TraceLite,
  TraceRequestProps,
} from 'app/utils/performance/quickTrace/types';
import {
  beforeFetch,
  getQuickTraceRequestPayload,
  makeEventView,
} from 'app/utils/performance/quickTrace/utils';
import withApi from 'app/utils/withApi';

type AdditionalQueryProps = {
  eventId: string;
};

type TraceLiteQueryChildrenProps = BaseTraceChildrenProps &
  Omit<PartialQuickTrace, 'trace'> & {
    trace: TraceLite | null;
  };

type QueryProps = Omit<TraceRequestProps, 'eventView'> &
  AdditionalQueryProps & {
    children: (props: TraceLiteQueryChildrenProps) => React.ReactNode;
  };

function getTraceLiteRequestPayload({
  eventId,
  ...props
}: DiscoverQueryProps & AdditionalQueryProps) {
  const additionalApiPayload = getQuickTraceRequestPayload(props);
  return Object.assign({event_id: eventId}, additionalApiPayload);
}

function EmptyTrace({children}: Pick<QueryProps, 'children'>) {
  return (
    <React.Fragment>
      {children({
        isLoading: false,
        error: null,
        trace: null,
        type: 'partial',
      })}
    </React.Fragment>
  );
}

function TraceLiteQuery({
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
    <GenericDiscoverQuery<TraceLite, AdditionalQueryProps>
      route={`events-trace-light/${traceId}`}
      getRequestPayload={getTraceLiteRequestPayload}
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
