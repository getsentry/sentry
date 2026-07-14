type ComponentCategory =
  | 'typography'
  | 'layout'
  | 'buttons'
  | 'controls'
  | 'forms'
  | 'navigation'
  | 'status'
  | 'display'
  | 'overlays'
  | 'utilities'
  | 'shared';

interface StoryResources {
  a11y?: Record<string, string>;
  figma?: string;
  js?: string;
  reference?: Record<string, string>;
}

/**
 * Frontmatter schema for MDX story files.
 * Validated at type-check time via Volar + @mdx-js/language-service.
 *
 * See contributing.mdx for field documentation.
 */
export interface MDXFrontmatter {
  description: string;
  title: string;
  category?: ComponentCategory;
  layout?: 'document';
  resources?: StoryResources;
  source?: string;
  status?: 'in-progress' | 'experimental' | 'stable';
  types?: string;
}
