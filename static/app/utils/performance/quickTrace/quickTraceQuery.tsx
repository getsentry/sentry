import {Fragment} from 'react';
import * as Sentry from '@sentry/react';

import {Event} from 'sentry/types/event';
import {DiscoverQueryProps} from 'sentry/utils/discover/genericDiscoverQuery';
import {TraceFullQuery} from 'sentry/utils/performance/quickTrace/traceFullQuery';
import TraceLiteQuery from 'sentry/utils/performance/quickTrace/traceLiteQuery';
import {
  EventLite,
  QuickTraceQueryChildrenProps,
  TraceFull,
  TraceLite,
  TraceSplitResults,
} from 'sentry/utils/performance/quickTrace/types';
import {
  flattenRelevantPaths,
  getTraceTimeRangeFromEvent,
  isCurrentEvent,
  isTraceSplitResult,
} from 'sentry/utils/performance/quickTrace/utils';
import useOrganization from 'sentry/utils/useOrganization';
import {getTraceSplitResults} from 'sentry/views/performance/traceDetails/utils';

type QueryProps = Omit<DiscoverQueryProps, 'api' | 'eventView'> & {
  children: (props: QuickTraceQueryChildrenProps) => React.ReactNode;
  event: Event | undefined;
};

export default function QuickTraceQuery({children, event, ...props}: QueryProps) {
  const organization = useOrganization();
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
            const {transactions, orphanErrors} = getTraceSplitResults<TraceFull>(
              traceFullResults.traces ?? [],
              organization
            );

            const scope = new Sentry.Scope();
            const traceErrorMsg = 'Trace endpoints returning non-array in response';
            scope.setFingerprint([traceErrorMsg]);

            if (
              !traceFullResults.isLoading &&
              traceFullResults.error === null &&
              traceFullResults.traces !== null
            ) {
              const orphanError = orphanErrors?.find(e => e.event_id === event.id);
              if (orphanError) {
                return children({
                  ...traceFullResults,
                  trace: [],
                  orphanErrors: [orphanError],
                  currentEvent: orphanError,
                });
              }

              const traceTransactions =
                transactions ?? (traceFullResults.traces as TraceFull[]);

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
              const {trace} = traceLiteResults;
              const {transactions: transactionLite, orphanErrors: orphanErrorsLite} =
                getTraceSplitResults<EventLite>(trace ?? [], organization);

              const orphanError =
                orphanErrorsLite && orphanErrorsLite.length === 1
                  ? orphanErrorsLite[0]
                  : undefined;
              const traceTransactions = transactionLite ?? (trace as TraceLite);

              let traceTransaction: EventLite | undefined;
              try {
                traceTransaction = traceTransactions.find(e => isCurrentEvent(e, event));
              } catch {
                scope.setExtras({
                  traceTransaction,
                  orphanError,
                  traceTransactions,
                  trace,
                });
                Sentry.captureException(new Error(traceErrorMsg), scope);
              }

              return children({
                ...traceLiteResults,
                trace: Array.isArray(traceTransactions) ? traceTransactions : [],
                orphanErrors: orphanErrorsLite,
                currentEvent: orphanError ?? traceTransaction ?? null,
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
                (transactions && transactions.length) ||
                (traceFullResults.traces &&
                  !isTraceSplitResult<TraceSplitResults<TraceFull>, TraceFull[]>(
                    traceFullResults.traces
                  ) &&
                  traceFullResults.traces?.length)
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
