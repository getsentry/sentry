import type {Environment} from 'sentry/types/project';

const DEFAULT_EMPTY_ROUTING_NAME = 'none';
const DEFAULT_EMPTY_ENV_NAME = '(No Environment)';

/**
 * Double encodes the environment name or display name to be used in the URL routing name.
 * This is necessary because the environment name or display name may contain special characters
 * that need to be encoded for the URL.
 */
export function getUrlRoutingName(env: Partial<Environment>) {
  if (env.name) {
    return encodeURIComponent(encodeURIComponent(env.name));
  }

  if (env.displayName) {
    return encodeURIComponent(encodeURIComponent(env.displayName));
  }
  return DEFAULT_EMPTY_ROUTING_NAME;
}

export function getDisplayName(env: Partial<Environment>) {
  return env.name || env.displayName || DEFAULT_EMPTY_ENV_NAME;
}
