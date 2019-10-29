import {toTitleCase} from 'app/utils';

const DEFAULT_EMPTY_ROUTING_NAME = 'none';
const DEFAULT_EMPTY_ENV_NAME = '(No Environment)';

export function getUrlRoutingName(env: Environment) {
  return encodeURIComponent(env.name) || DEFAULT_EMPTY_ROUTING_NAME;
}

export function getDisplayName(env: Environment) {
  return toTitleCase(env.name) || DEFAULT_EMPTY_ENV_NAME;
}
