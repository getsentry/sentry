import {RequestError} from 'sentry/utils/requestError/requestError';

export function canRetryOAuthRequest(error: Error | null): boolean {
  return (
    !(error instanceof RequestError) ||
    error.status === undefined ||
    error.status === 429 ||
    error.status >= 500
  );
}
