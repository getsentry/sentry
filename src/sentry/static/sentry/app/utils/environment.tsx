import {Environment} from 'app/types';

const DEFAULT_EMPTY_ROUTING_NAME = 'none';
const DEFAULT_EMPTY_ENV_NAME = '(No Environment)';

export function getUrlRoutingName(env: Omit<Environment, 'id'>) {
  return encodeURIComponent(env.name) || DEFAULT_EMPTY_ROUTING_NAME;
}

export function getDisplayName(env: Omit<Environment, 'id'>) {
  return env.name || DEFAULT_EMPTY_ENV_NAME;
}
