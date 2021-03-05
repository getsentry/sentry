import React from 'react';
import * as Sentry from '@sentry/react';

import {getTraceDateTimeRange} from 'app/components/events/interfaces/spans/utils';
import {Event} from 'app/types/event';
import {DiscoverQueryProps} from 'app/utils/discover/genericDiscoverQuery';
import TraceFullQuery from 'app/utils/performance/quickTrace/traceFullQuery';
import TraceLiteQuery from 'app/utils/performance/quickTrace/traceLiteQuery';
import {QuickTraceQueryChildrenProps} from 'app/utils/performance/quickTrace/types';
import {
  flattenRelevantPaths,
  isTransaction,
} from 'app/utils/performance/quickTrace/utils';

type QueryProps = Omit<DiscoverQueryProps, 'api' | 'eventView'> & {
  event: Event;
  children: (props: QuickTraceQueryChildrenProps) => React.ReactNode;
};

export default function QuickTraceQuery({children, event, ...props}: QueryProps) {
  const traceId = event.contexts?.trace?.trace_id;

  // non transaction events are currently unsupported
  if (!isTransaction(event) || !traceId) {
    return (
      <React.Fragment>
        {children({
          isLoading: false,
          error: null,
          trace: [],
          type: 'empty',
        })}
      </React.Fragment>
    );
  }

  const {start, end} = getTraceDateTimeRange({
    start: event.startTimestamp,
    end: event.endTimestamp,
  });

  return (
    <TraceLiteQuery
      eventId={event.id}
      traceId={traceId}
      start={start}
      end={end}
      {...props}
    >
      {traceLiteResults => (
        <TraceFullQuery traceId={traceId} start={start} end={end} {...props}>
          {traceFullResults => {
            if (
              !traceFullResults.isLoading &&
              traceFullResults.error === null &&
              traceFullResults.trace !== null
            ) {
              try {
                const trace = flattenRelevantPaths(event, traceFullResults.trace);
                return children({
                  ...traceFullResults,
                  trace,
                });
              } catch (error) {
                Sentry.setTag('currentTraceId', traceId);
                Sentry.captureException(error);
              }
            }

            if (
              !traceLiteResults.isLoading &&
              traceLiteResults.error === null &&
              traceLiteResults.trace !== null
            ) {
              return children(traceLiteResults);
            }

            return children({
              isLoading: traceFullResults.isLoading || traceLiteResults.isLoading,
              error: traceFullResults.error ?? traceLiteResults.error,
              trace: [],
              type: 'empty',
            });
          }}
        </TraceFullQuery>
      )}
    </TraceLiteQuery>
  );
}
