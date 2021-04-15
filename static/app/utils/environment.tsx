import {Environment} from 'app/types';

const DEFAULT_EMPTY_ROUTING_NAME = 'none';
const DEFAULT_EMPTY_ENV_NAME = '(No Environment)';

export function getUrlRoutingName(env: Partial<Environment>) {
  if (env.name) {
    return encodeURIComponent(env.name);
  }

  if (env.displayName) {
    return encodeURIComponent(env.displayName);
  }
  return DEFAULT_EMPTY_ROUTING_NAME;
}

export function getDisplayName(env: Partial<Environment>) {
  return env.name || env.displayName || DEFAULT_EMPTY_ENV_NAME;
}
