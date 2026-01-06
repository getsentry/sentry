import storiesIndex from 'sentry/virtual/stories-index.js';

import type {MDXStoryDescriptor} from './useStoriesLoader';

export type StoriesIndex = Record<
  string,
  {
    frontmatter: MDXStoryDescriptor['exports']['frontmatter'] | undefined;
    content?: string;
  }
>;

/**
 * Returns the pre-built frontmatter index generated at build time.
 * This enables category-based grouping without runtime MDX loading.
 */
export function useStoriesIndex(): StoriesIndex {
  return storiesIndex;
}
