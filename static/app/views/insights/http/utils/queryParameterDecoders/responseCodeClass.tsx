import {decodeScalar} from 'sentry/utils/queryString';

const OPTIONS = ['' as const, '2' as const, '3' as const, '4' as const, '5' as const];
const DEFAULT = '';

type ResponseCodeClass = (typeof OPTIONS)[number];

export default function decode(
  value: string | string[] | undefined | null
): ResponseCodeClass {
  const decodedValue = decodeScalar(value, DEFAULT);

  if (isAValidOption(decodedValue)) {
    return decodedValue;
  }

  return DEFAULT;
}

function isAValidOption(maybeOption: string): maybeOption is ResponseCodeClass {
  // Manually widen  to allow the comparison to string
  return (OPTIONS as unknown as string[]).includes(maybeOption as ResponseCodeClass);
}
