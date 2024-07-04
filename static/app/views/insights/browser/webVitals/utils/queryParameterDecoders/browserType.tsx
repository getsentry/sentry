import {decodeScalar} from 'sentry/utils/queryString';
import {BrowserType} from 'sentry/views/insights/browser/webVitals/components/browserTypeSelector';

const DEFAULT = BrowserType.ALL;

export default function decode(value: string | string[] | undefined | null): BrowserType {
  const decodedValue = decodeScalar(value, DEFAULT);

  if (isAValidOption(decodedValue)) {
    return decodedValue;
  }

  return DEFAULT;
}

function isAValidOption(maybeOption: string): maybeOption is BrowserType {
  // Manually widen to allow the comparison to string
  return Object.values(BrowserType).includes(maybeOption as BrowserType);
}
