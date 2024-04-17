import TagStore from 'sentry/stores/tagStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {TagCollection} from 'sentry/types/group';

function useTags(): TagCollection {
  return useLegacyStore(TagStore);
}

export default useTags;
