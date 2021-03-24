import React from 'react';

import {Event} from 'app/types/event';
import {DiscoverQueryProps} from 'app/utils/discover/genericDiscoverQuery';
import {TraceFullQuery} from 'app/utils/performance/quickTrace/traceFullQuery';
import TraceLiteQuery from 'app/utils/performance/quickTrace/traceLiteQuery';
import {QuickTraceQueryChildrenProps} from 'app/utils/performance/quickTrace/types';
import {
  flattenRelevantPaths,
  getTraceTimeRangeFromEvent,
} from 'app/utils/performance/quickTrace/utils';

type QueryProps = Omit<DiscoverQueryProps, 'api' | 'eventView'> & {
  event: Event;
  children: (props: QuickTraceQueryChildrenProps) => React.ReactNode;
};

export default function QuickTraceQuery({children, event, ...props}: QueryProps) {
  const traceId = event.contexts?.trace?.trace_id;

  if (!traceId) {
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

  const {start, end} = getTraceTimeRangeFromEvent(event);

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
              } catch {
                // let this fall through and use the lite results
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
