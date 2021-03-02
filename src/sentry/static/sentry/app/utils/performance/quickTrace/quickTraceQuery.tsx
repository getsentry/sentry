import React from 'react';
import * as Sentry from '@sentry/react';

import TraceFullQuery from 'app/utils/performance/quickTrace/traceFullQuery';
import TraceLiteQuery from 'app/utils/performance/quickTrace/traceLiteQuery';
import {
  QuickTraceQueryChildrenProps,
  TraceRequestProps,
} from 'app/utils/performance/quickTrace/types';
import {flattenRelevantPaths} from 'app/utils/performance/quickTrace/utils';

type QueryProps = Omit<TraceRequestProps, 'api' | 'eventView'> & {
  children: (props: QuickTraceQueryChildrenProps) => React.ReactNode;
};

export default function QuickTraceQuery({children, ...props}: QueryProps) {
  return (
    <TraceLiteQuery {...props}>
      {traceLiteResults => (
        <TraceFullQuery {...props}>
          {traceFullResults => {
            if (
              !traceFullResults.isLoading &&
              traceFullResults.error === null &&
              traceFullResults.trace !== null
            ) {
              try {
                const trace = flattenRelevantPaths(props.event, traceFullResults.trace);
                return children({
                  ...traceFullResults,
                  trace,
                });
              } catch (error) {
                Sentry.setTag('currentTraceId', props.event.contexts?.trace?.trace_id);
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
