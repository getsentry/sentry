import type {Environment} from 'sentry/types/project';

const DEFAULT_EMPTY_ENV_NAME = '(No Environment)';

export function getDisplayName(env: Partial<Environment>) {
  return env.name || env.displayName || DEFAULT_EMPTY_ENV_NAME;
}
