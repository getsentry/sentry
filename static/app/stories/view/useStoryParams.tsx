import {useLocation} from 'sentry/utils/useLocation';

import type {StoryCategory} from './storyTree';

export function useStoryParams(): {storyCategory?: StoryCategory; storySlug?: string} {
  const location = useLocation();
  // Match: /scraps/:category/(one/optional/or/more/path/segments)
  // Handles both /scraps/... and /organizations/{org}/scraps/...
  // Supports optional trailing slashes
  const match = location.pathname.match(/\/scraps\/([^/]+)\/(.+?)\/?$/);
  return {
    storyCategory: match?.[1] as StoryCategory | undefined,
    storySlug: match?.[2] ?? undefined,
  };
}
