import React from 'react';

import {Event} from 'app/types/event';
import {DiscoverQueryProps} from 'app/utils/discover/genericDiscoverQuery';
import {TraceFullQuery} from 'app/utils/performance/quickTrace/traceFullQuery';
import TraceLiteQuery from 'app/utils/performance/quickTrace/traceLiteQuery';
import TraceMetaQuery, {
  TraceMetaQueryChildrenProps,
} from 'app/utils/performance/quickTrace/traceMetaQuery';
import {QuickTraceQueryChildrenProps} from 'app/utils/performance/quickTrace/types';
import {
  flattenRelevantPaths,
  getTraceTimeRangeFromEvent,
} from 'app/utils/performance/quickTrace/utils';

type QueryProps = Omit<DiscoverQueryProps, 'api' | 'eventView'> & {
  children: (props: QuickTraceQueryChildrenProps) => React.ReactNode;
  event: Event;
  withMeta?: boolean;
};

export default function QuickTraceQuery({
  children,
  event,
  withMeta = true,
  ...props
}: QueryProps) {
  const traceId = event.contexts?.trace?.trace_id;

  if (!traceId) {
    return (
      <React.Fragment>
        {children({
          isLoading: false,
          error: null,
          trace: [],
          meta: null,
          type: 'empty',
        })}
      </React.Fragment>
    );
  }

  const {start, end} = getTraceTimeRangeFromEvent(event);

  const results = (metaResults: TraceMetaQueryChildrenProps) => (
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
              traceFullResults.traces !== null
            ) {
              for (const subtrace of traceFullResults.traces) {
                try {
                  const trace = flattenRelevantPaths(event, subtrace);
                  return children({
                    ...traceFullResults,
                    isLoading: traceFullResults.isLoading || metaResults.isLoading,
                    error: traceFullResults.error || metaResults.error,
                    trace,
                    meta: metaResults.meta,
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
              return children({
                ...traceLiteResults,
                isLoading: traceLiteResults.isLoading || metaResults.isLoading,
                error: traceLiteResults.error || metaResults.error,
                meta: metaResults.meta,
              });
            }

            return children({
              isLoading:
                traceFullResults.isLoading ||
                traceLiteResults.isLoading ||
                metaResults.isLoading,
              error:
                traceFullResults.error || traceLiteResults.error || metaResults.error,
              trace: [],
              meta: null,
              type: 'empty',
            });
          }}
        </TraceFullQuery>
      )}
    </TraceLiteQuery>
  );

  if (withMeta) {
    return (
      <TraceMetaQuery traceId={traceId} start={start} end={end} {...props}>
        {results}
      </TraceMetaQuery>
    );
  }

  return results({
    isLoading: false,
    error: null,
    meta: null,
  });
}
