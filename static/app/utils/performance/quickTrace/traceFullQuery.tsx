import * as React from 'react';

import GenericDiscoverQuery, {
  DiscoverQueryProps,
} from 'app/utils/discover/genericDiscoverQuery';
import {
  BaseTraceChildrenProps,
  FullQuickTrace,
  TraceFull,
  TraceFullDetailed,
  TraceRequestProps,
} from 'app/utils/performance/quickTrace/types';
import {
  beforeFetch,
  getTraceRequestPayload,
  makeEventView,
} from 'app/utils/performance/quickTrace/utils';
import withApi from 'app/utils/withApi';

type AdditionalQueryProps = {
  eventId?: string;
  detailed?: boolean;
};

type TraceFullQueryChildrenProps<T> = BaseTraceChildrenProps &
  Omit<FullQuickTrace, 'trace'> & {
    /**
     * The `event-trace` endpoint returns a full trace with the parent-child
     * relationships. It can be flattened into a `QuickTraceEvent` if necessary.
     */
    traces: T | null;
  };

type QueryProps<T> = Omit<TraceRequestProps, 'eventView'> &
  AdditionalQueryProps & {
    children: (props: TraceFullQueryChildrenProps<T>) => React.ReactNode;
  };

function getTraceFullRequestPayload({
  detailed,
  eventId,
  ...props
}: DiscoverQueryProps & AdditionalQueryProps) {
  const additionalApiPayload: any = getTraceRequestPayload(props);
  additionalApiPayload.detailed = detailed ? '1' : '0';
  if (eventId) {
    additionalApiPayload.event_id = eventId;
  }
  return additionalApiPayload;
}

function EmptyTrace<T>({children}: Pick<QueryProps<T>, 'children'>) {
  return (
    <React.Fragment>
      {children({
        isLoading: false,
        error: null,
        traces: null,
        type: 'full',
      })}
    </React.Fragment>
  );
}

function GenericTraceFullQuery<T>({
  traceId,
  start,
  end,
  statsPeriod,
  children,
  ...props
}: QueryProps<T>) {
  if (!traceId) {
    return <EmptyTrace<T>>{children}</EmptyTrace>;
  }

  const eventView = makeEventView({start, end, statsPeriod});

  return (
    <GenericDiscoverQuery<T, AdditionalQueryProps>
      route={`events-trace/${traceId}`}
      getRequestPayload={getTraceFullRequestPayload}
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
          traces: tableData || null,
          type: 'full',
          ...rest,
        })
      }
    </GenericDiscoverQuery>
  );
}

export const TraceFullQuery = withApi(
  (props: Omit<QueryProps<TraceFull[]>, 'detailed'>) => (
    <GenericTraceFullQuery<TraceFull[]> {...props} detailed={false} />
  )
);

export const TraceFullDetailedQuery = withApi(
  (props: Omit<QueryProps<TraceFullDetailed[]>, 'detailed'>) => (
    <GenericTraceFullQuery<TraceFullDetailed[]> {...props} detailed />
  )
);
