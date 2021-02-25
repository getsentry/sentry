import React from 'react';

import {DiscoverQueryProps} from 'app/utils/discover/genericDiscoverQuery';
import TraceFullQuery from 'app/utils/performance/quickTrace/traceFullQuery';
import TraceLiteQuery from 'app/utils/performance/quickTrace/traceLiteQuery';
import {
  TraceLiteQueryChildrenProps,
  TraceProps,
} from 'app/utils/performance/quickTrace/types';
import {flattenRelevantPaths} from 'app/utils/performance/quickTrace/utils';

type RequestProps = DiscoverQueryProps & TraceProps;

export type QuickTraceQueryChildrenProps = TraceLiteQueryChildrenProps & {
  type?: 'partial' | 'full';
};

type QueryProps = Omit<RequestProps, 'api' | 'eventView'> & {
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
              const trace = flattenRelevantPaths(props.event, traceFullResults.trace);
              return children({
                ...traceFullResults,
                trace,
                type: 'full',
              });
            }

            if (
              !traceLiteResults.isLoading &&
              traceLiteResults.error === null &&
              traceLiteResults.trace !== null
            ) {
              return children({
                ...traceLiteResults,
                type: 'partial',
              });
            } else {
              return children({
                isLoading: traceFullResults.isLoading || traceLiteResults.isLoading,
                error: traceFullResults.error ?? traceLiteResults.error,
                trace: [],
              });
            }
          }}
        </TraceFullQuery>
      )}
    </TraceLiteQuery>
  );
}
