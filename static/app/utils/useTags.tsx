import {useSelector} from '@tanstack/react-store';

import {TagStore} from 'sentry/stores/tagStore';
import type {TagCollection} from 'sentry/types/group';

export function useTags(): TagCollection {
  return useSelector(TagStore.store);
}
