import {decodeScalar} from 'sentry/utils/queryString';
import {TRACE_STATUS_OPTIONS} from 'sentry/views/insights/queues/settings';

// Include default value of '' that represents all options
const OPTIONS = ['', ...TRACE_STATUS_OPTIONS] as const;
const DEFAULT = '';

type TraceStatus = (typeof OPTIONS)[number];

export default function decode(value: string | string[] | undefined | null): TraceStatus {
  const decodedValue = decodeScalar(value, DEFAULT);

  if (isAValidOption(decodedValue)) {
    return decodedValue;
  }

  return DEFAULT;
}

function isAValidOption(maybeOption: string): maybeOption is TraceStatus {
  // Manually widen to allow the comparison to string
  return (OPTIONS as unknown as string[]).includes(maybeOption);
}
