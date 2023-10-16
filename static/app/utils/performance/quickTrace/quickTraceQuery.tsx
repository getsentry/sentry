import {Fragment} from 'react';
import * as Sentry from '@sentry/react';

import {Event} from 'sentry/types/event';
import {DiscoverQueryProps} from 'sentry/utils/discover/genericDiscoverQuery';
import {TraceFullQuery} from 'sentry/utils/performance/quickTrace/traceFullQuery';
import TraceLiteQuery from 'sentry/utils/performance/quickTrace/traceLiteQuery';
import {
  EventLite,
  QuickTraceQueryChildrenProps,
} from 'sentry/utils/performance/quickTrace/types';
import {
  flattenRelevantPaths,
  getTraceTimeRangeFromEvent,
  isCurrentEvent,
} from 'sentry/utils/performance/quickTrace/utils';

type QueryProps = Omit<DiscoverQueryProps, 'api' | 'eventView'> & {
  children: (props: QuickTraceQueryChildrenProps) => React.ReactNode;
  event: Event | undefined;
};

export default function QuickTraceQuery({children, event, ...props}: QueryProps) {
  const renderEmpty = () => (
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

  if (!event) {
    return renderEmpty();
  }

  const traceId = event.contexts?.trace?.trace_id;

  if (!traceId) {
    return renderEmpty();
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
            const scope = new Sentry.Scope();
            const traceErrorMsg =
              'Updated: Trace endpoints returning non-array in response';
            scope.setFingerprint([traceErrorMsg]);

            if (
              !traceFullResults.isLoading &&
              traceFullResults.error === null &&
              traceFullResults.traces !== null
            ) {
              const orphanError = traceFullResults.traces.orphan_errors?.find(
                e => e.event_id === event.id
              );
              if (orphanError) {
                return children({
                  ...traceFullResults,
                  trace: [],
                  orphanErrors: [orphanError],
                  currentEvent: orphanError,
                });
              }

              const traceTransactions = traceFullResults.traces.transactions;

              try {
                for (const subtrace of traceTransactions) {
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
              } catch {
                // capture exception and let this fall through to
                // use the /events-trace-lite/ response below
                scope.setExtras({
                  traceTransactions,
                  traceFullResults,
                });
                Sentry.captureException(new Error(traceErrorMsg), scope);
              }
            }

            if (
              !traceLiteResults.isLoading &&
              traceLiteResults.error === null &&
              traceLiteResults.trace !== null
            ) {
              const orphanErrorsLite = traceLiteResults.trace.orphan_errors;
              const transactionsLite = traceLiteResults.trace.transactions;

              const currentOrphanError =
                orphanErrorsLite && orphanErrorsLite.length === 1
                  ? orphanErrorsLite[0]
                  : undefined;

              let traceTransaction: EventLite | undefined;
              try {
                traceTransaction = transactionsLite.find(e => isCurrentEvent(e, event));
              } catch {
                scope.setExtras({
                  traceTransaction,
                  currentOrphanError,
                  transactionsLite,
                  trace: traceLiteResults.trace,
                });
                Sentry.captureException(new Error(traceErrorMsg), scope);
              }

              return children({
                ...traceLiteResults,
                trace: Array.isArray(transactionsLite) ? transactionsLite : [],
                orphanErrors: orphanErrorsLite,
                currentEvent: currentOrphanError ?? traceTransaction ?? null,
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
              type:
                traceFullResults.traces?.transactions &&
                traceFullResults.traces?.transactions.length
                  ? 'missing'
                  : 'empty',
              currentEvent: null,
            });
          }}
        </TraceFullQuery>
      )}
    </TraceLiteQuery>
  );
}
