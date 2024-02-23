import {Fragment} from 'react';

import type {DiscoverQueryProps} from 'sentry/utils/discover/genericDiscoverQuery';
import GenericDiscoverQuery from 'sentry/utils/discover/genericDiscoverQuery';
import type {
  BaseTraceChildrenProps,
  FullQuickTrace,
  TraceFull,
  TraceFullDetailed,
  TraceRequestProps,
  TraceSplitResults,
} from 'sentry/utils/performance/quickTrace/types';
import {
  getTraceRequestPayload,
  makeEventView,
} from 'sentry/utils/performance/quickTrace/utils';

type AdditionalQueryProps = {
  eventId?: string;
  limit?: number;
  type?: 'detailed' | 'spans';
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
  type,
  eventId,
  limit,
  ...props
}: DiscoverQueryProps & AdditionalQueryProps) {
  const additionalApiPayload: any = getTraceRequestPayload(props);

  if (type === 'spans') {
    additionalApiPayload.useSpans = '1';
  } else {
    additionalApiPayload.detailed = '1';
  }

  if (eventId) {
    additionalApiPayload.event_id = eventId;
  }

  if (limit) {
    additionalApiPayload.limit = limit;
  }

  return additionalApiPayload;
}

function EmptyTrace<T>({children}: Pick<QueryProps<T>, 'children'>) {
  return (
    <Fragment>
      {children({
        isLoading: false,
        error: null,
        traces: null,
        type: 'full',
      })}
    </Fragment>
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

export function TraceFullQuery(
  props: Omit<QueryProps<TraceSplitResults<TraceFull>>, 'detailed'>
) {
  return <GenericTraceFullQuery<TraceSplitResults<TraceFull>> {...props} />;
}

export function TraceFullDetailedQuery(
  props: QueryProps<TraceSplitResults<TraceFullDetailed>>
) {
  return <GenericTraceFullQuery<TraceSplitResults<TraceFullDetailed>> {...props} />;
}
