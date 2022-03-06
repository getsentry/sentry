import TagStore from 'sentry/stores/tagStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';

export function useTags() {
  const tags = useLegacyStore(TagStore);

  return tags;
}
