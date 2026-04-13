import type {StoryResources} from './view/useStoriesLoader';

/**
 * Frontmatter schema for MDX story files.
 * Validated at type-check time via Volar + @mdx-js/language-service.
 *
 * See contributing.mdx for field documentation.
 */
export interface MDXFrontmatter {
  description: string;
  title: string;
  layout?: 'document';
  resources?: StoryResources;
  source?: string;
  status?: 'in-progress' | 'experimental' | 'stable';
  types?: string;
}
