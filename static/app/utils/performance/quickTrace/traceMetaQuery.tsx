import * as React from 'react';

import GenericDiscoverQuery from 'sentry/utils/discover/genericDiscoverQuery';
import {
  BaseTraceChildrenProps,
  TraceMeta,
  TraceRequestProps,
} from 'sentry/utils/performance/quickTrace/types';
import {
  getTraceRequestPayload,
  makeEventView,
} from 'sentry/utils/performance/quickTrace/utils';
import withApi from 'sentry/utils/withApi';

export type TraceMetaQueryChildrenProps = BaseTraceChildrenProps & {
  meta: TraceMeta | null;
};

type QueryProps = Omit<TraceRequestProps, 'eventView'> & {
  children: (props: TraceMetaQueryChildrenProps) => React.ReactNode;
};

function TraceMetaQuery({
  traceId,
  start,
  end,
  statsPeriod,
  children,
  ...props
}: QueryProps) {
  if (!traceId) {
    return (
      <React.Fragment>
        {children({
          isLoading: false,
          error: null,
          meta: null,
        })}
      </React.Fragment>
    );
  }

  const eventView = makeEventView({start, end, statsPeriod});

  return (
    <GenericDiscoverQuery<TraceMeta, {}>
      route={`events-trace-meta/${traceId}`}
      getRequestPayload={getTraceRequestPayload}
      eventView={eventView}
      {...props}
    >
      {({tableData, ...rest}) => {
        return children({
          meta: tableData,
          ...rest,
        });
      }}
    </GenericDiscoverQuery>
  );
}

export default withApi(TraceMetaQuery);
