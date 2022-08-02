import {Fragment} from 'react';

import {Event} from 'sentry/types/event';
import {DiscoverQueryProps} from 'sentry/utils/discover/genericDiscoverQuery';
import {TraceFullQuery} from 'sentry/utils/performance/quickTrace/traceFullQuery';
import TraceLiteQuery from 'sentry/utils/performance/quickTrace/traceLiteQuery';
import {QuickTraceQueryChildrenProps} from 'sentry/utils/performance/quickTrace/types';
import {
  flattenRelevantPaths,
  getTraceTimeRangeFromEvent,
  isCurrentEvent,
} from 'sentry/utils/performance/quickTrace/utils';

type QueryProps = Omit<DiscoverQueryProps, 'api' | 'eventView'> & {
  children: (props: QuickTraceQueryChildrenProps) => React.ReactNode;
  event: Event;
};

export default function QuickTraceQuery({children, event, ...props}: QueryProps) {
  const traceId = event.contexts?.trace?.trace_id;

  if (!traceId) {
    return (
      <Fragment>
        {children({
          isLoading: false,
          error: null,
          trace: [],
          type: 'empty',
          currentEvent: null,
        })}
      </Fragment>
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
        <TraceFullQuery
          eventId={event.id}
          traceId={traceId}
          start={start}
          end={end}
          {...props}
        >
          {traceFullResults => {
            if (
              !traceFullResults.isLoading &&
              traceFullResults.error === null &&
              traceFullResults.traces !== null
            ) {
              for (const subtrace of traceFullResults.traces) {
                try {
                  const trace = flattenRelevantPaths(event, subtrace);
                  return children({
                    ...traceFullResults,
                    trace,
                    currentEvent: trace.find(e => isCurrentEvent(e, event)) ?? null,
                  });
                } catch {
                  // let this fall through and check the next subtrace
                  // or use the trace lite results
                }
              }
            }

            if (
              !traceLiteResults.isLoading &&
              traceLiteResults.error === null &&
              traceLiteResults.trace !== null
            ) {
              const {trace} = traceLiteResults;
              return children({
                ...traceLiteResults,
                currentEvent: trace.find(e => isCurrentEvent(e, event)) ?? null,
              });
            }

            return children({
              // only use the light results loading state if it didn't error
              // if it did, we should rely on the full results
              isLoading: traceLiteResults.error
                ? traceFullResults.isLoading
                : traceLiteResults.isLoading || traceFullResults.isLoading,
              // swallow any errors from the light results because we
              // should rely on the full results in this situations
              error: traceFullResults.error,
              trace: [],
              // if we reach this point but there were some traces in the full results,
              // that means there were other transactions in the trace, but the current
              // event could not be found
              type: traceFullResults.traces?.length ? 'missing' : 'empty',
              currentEvent: null,
            });
          }}
        </TraceFullQuery>
      )}
    </TraceLiteQuery>
  );
}
