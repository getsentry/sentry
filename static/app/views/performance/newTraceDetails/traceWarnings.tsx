import Alert from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';

import {TraceType} from '../traceDetails/newTraceDetailsContent';

type TraceWarningsProps = {
  type: TraceType;
};

export default function TraceWarnings({type}: TraceWarningsProps) {
  switch (type) {
    case TraceType.NO_ROOT:
      return (
        <Alert type="info" showIcon>
          <ExternalLink href="https://docs.sentry.io/product/performance/trace-view/#orphan-traces-and-broken-subtraces">
            {t(
              'A root transaction is missing. Transactions linked by a dashed line have been orphaned and cannot be directly linked to the root.'
            )}
          </ExternalLink>
        </Alert>
      );
    case TraceType.BROKEN_SUBTRACES:
      return (
        <Alert type="info" showIcon>
          <ExternalLink href="https://docs.sentry.io/product/performance/trace-view/#orphan-traces-and-broken-subtraces">
            {t(
              'This trace has broken subtraces. Transactions linked by a dashed line have been orphaned and cannot be directly linked to the root.'
            )}
          </ExternalLink>
        </Alert>
      );
    case TraceType.MULTIPLE_ROOTS:
      return (
        <Alert type="info" showIcon>
          <ExternalLink href="https://docs.sentry.io/product/sentry-basics/tracing/trace-view/#multiple-roots">
            {t('Multiple root transactions have been found with this trace ID.')}
          </ExternalLink>
        </Alert>
      );
    case TraceType.ONLY_ERRORS:
      return (
        <Alert type="info" showIcon>
          {tct(
            "The good news is we know these errors are related to each other. The bad news is that we can't tell you more than that. If you haven't already, [tracingLink: configure performance monitoring for your SDKs] to learn more about service interactions.",
            {
              tracingLink: (
                <ExternalLink href="https://docs.sentry.io/product/performance/getting-started/" />
              ),
            }
          )}
        </Alert>
      );
    case TraceType.ONE_ROOT:
    case TraceType.EMPTY_TRACE:
      return null;
    default:
      throw new TypeError('Invalid trace type');
  }
}
