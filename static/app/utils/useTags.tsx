import type {TagCollection} from 'sentry/types/group';

import TagStore from 'sentry/stores/tagStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';

function useTags(): TagCollection {
  return useLegacyStore(TagStore);
}

export default useTags;
