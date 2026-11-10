import {RequestError} from 'sentry/utils/requestError/requestError';

/**
 * Offer an explicit retry for transport failures, throttling, and server errors.
 * Other HTTP failures require a new request or authentication; repeating the same
 * request cannot repair them. OAuth queries disable automatic retries separately.
 */
export function canRetryOAuthRequest(error: Error | null): boolean {
  return (
    !(error instanceof RequestError) ||
    error.status === undefined ||
    error.status === 429 ||
    error.status >= 500
  );
}
