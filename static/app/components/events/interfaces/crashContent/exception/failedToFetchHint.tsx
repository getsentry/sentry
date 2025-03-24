import {Alert} from 'sentry/components/core/alert';
import Link from 'sentry/components/links/link';

export function FailedToFetchHint() {
  return (
    <Alert type="info">
      This error might be caused by network connectivity issues, browser extensions, or
      CORS restrictions. Check out{' '}
      <Link to="https://sentry.io/answers/failed-to-fetch-javascript/">
        our troubleshooting article
      </Link>{' '}
      on how to resolve this issue.
    </Alert>
  );
}
