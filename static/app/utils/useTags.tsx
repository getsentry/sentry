import {TagStore} from 'sentry/stores/tagStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {TagCollection} from 'sentry/types/group';

export function useTags(): TagCollection {
  return useLegacyStore(TagStore);
}
