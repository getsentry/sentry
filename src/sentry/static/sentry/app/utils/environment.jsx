import {toTitleCase} from 'app/utils';

const DEFAULT_EMPTY_ROUTING_NAME = 'none';
const DEFAULT_EMPTY_ENV_NAME = '(No Environment)';

export function getUrlRoutingName(env) {
  return encodeURIComponent(env.name) || DEFAULT_EMPTY_ROUTING_NAME;
}

export function getDisplayName(env) {
  return toTitleCase(env.name) || DEFAULT_EMPTY_ENV_NAME;
}
