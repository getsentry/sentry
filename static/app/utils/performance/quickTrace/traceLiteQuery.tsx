import {Fragment} from 'react';

import GenericDiscoverQuery, {
  DiscoverQueryProps,
} from 'sentry/utils/discover/genericDiscoverQuery';
import {
  BaseTraceChildrenProps,
  EventLite,
  PartialQuickTrace,
  TraceRequestProps,
  TraceSplitResults,
} from 'sentry/utils/performance/quickTrace/types';
import {
  getTraceRequestPayload,
  makeEventView,
} from 'sentry/utils/performance/quickTrace/utils';

type AdditionalQueryProps = {
  eventId: string;
};

type TraceLiteQueryChildrenProps = BaseTraceChildrenProps &
  Omit<PartialQuickTrace, 'trace'> & {
    trace: TraceSplitResults<EventLite> | null;
  };

type QueryProps = Omit<TraceRequestProps, 'eventView'> &
  AdditionalQueryProps & {
    children: (props: TraceLiteQueryChildrenProps) => React.ReactNode;
  };

function getTraceLiteRequestPayload({
  eventId,
  ...props
}: DiscoverQueryProps & AdditionalQueryProps) {
  const additionalApiPayload = getTraceRequestPayload(props);
  return Object.assign({event_id: eventId}, additionalApiPayload);
}

function EmptyTrace({children}: Pick<QueryProps, 'children'>) {
  return (
    <Fragment>
      {children({
        isLoading: false,
        error: null,
        trace: null,
        type: 'partial',
      })}
    </Fragment>
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
    <GenericDiscoverQuery<TraceSplitResults<EventLite>, AdditionalQueryProps>
      route={`events-trace-light/${traceId}`}
      getRequestPayload={getTraceLiteRequestPayload}
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

export default TraceLiteQuery;
