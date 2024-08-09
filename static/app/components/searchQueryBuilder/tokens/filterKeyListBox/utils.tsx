import {getEscapedKey} from 'sentry/components/compactSelect/utils';

const RECENT_FILTER_KEY_PREFIX = '__recent_filter_key__';

export function createRecentFilterOptionKey(filter: string) {
  return getEscapedKey(`${RECENT_FILTER_KEY_PREFIX}${filter}`);
}
