import type {ElementType} from 'react';

import type {MDXFrontmatter} from 'sentry/stories/frontmatter';

export type StoryDocumentation = Promise<
  TypeLoader.TypeLoaderResult | {default: TypeLoader.TypeLoaderResult}
>;

export interface MDXStoryExports {
  default: ElementType;
  documentation?: StoryDocumentation;
  frontmatter?: MDXFrontmatter;
}

export interface TSStoryExports {
  [exportName: string]: unknown;
  default?: ElementType;
  documentation?: StoryDocumentation;
}

interface LoadedStory<TExports> {
  exports: TExports;
  filename: string;
}

export type MDXStoryDescriptor = LoadedStory<MDXStoryExports>;
type TSStoryDescriptor = LoadedStory<TSStoryExports>;
export type StoryDescriptor = MDXStoryDescriptor | TSStoryDescriptor;

export function isMDXStory(story: StoryDescriptor): story is MDXStoryDescriptor {
  return story.filename.endsWith('.mdx');
}
