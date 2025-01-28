import {decodeScalar} from 'sentry/utils/queryString';
import {RETRY_COUNT_OPTIONS} from 'sentry/views/insights/queues/settings';

// Include default value of '' that represents all options
const OPTIONS = ['', ...RETRY_COUNT_OPTIONS] as const;
const DEFAULT = '';

type RetryCount = (typeof OPTIONS)[number];

export default function decode(value: string | string[] | undefined | null): RetryCount {
  const decodedValue = decodeScalar(value, DEFAULT);

  if (isAValidOption(decodedValue)) {
    return decodedValue;
  }

  return DEFAULT;
}

function isAValidOption(maybeOption: string): maybeOption is RetryCount {
  // Manually widen to allow the comparison to string
  return (OPTIONS as unknown as string[]).includes(maybeOption);
}
