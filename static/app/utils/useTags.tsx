import {useStore} from 'zustand';

import {TagStore} from 'sentry/stores/tagStore';
import type {TagCollection} from 'sentry/types/group';

export function useTags(): TagCollection {
  return useStore(TagStore);
}
