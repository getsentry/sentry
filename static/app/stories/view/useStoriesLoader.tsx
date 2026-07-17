import type React from 'react';
import {useSyncExternalStore} from 'react';
import {useQuery} from '@tanstack/react-query';
import type {UseQueryResult} from '@tanstack/react-query';

import type {MDXFrontmatter} from 'sentry/stories/frontmatter';
import {
  getStoriesHmrVersion,
  storyImports,
  subscribeToStoriesHmr,
} from 'sentry/stories/storyManifest.generated';

if (process.env.NODE_ENV === 'development' && import.meta.webpackHot) {
  // Adding or removing a story changes the manifest module itself. Reload so
  // every consumer (including React Aria's collection state) sees the new file
  // set. Edits to existing stories remain hot through the manifest's explicit
  // dependency accept handlers.
  import.meta.webpackHot.accept('sentry/stories/storyManifest.generated', () => {
    window.location.reload();
  });
}

export interface StoryResources {
  a11y?: Record<string, string>;
  figma?: string;
  js?: string;
  reference?: Record<string, string>;
}

export type StoryDocumentation = Promise<
  TypeLoader.TypeLoaderResult | {default: TypeLoader.TypeLoaderResult}
>;

export interface MDXStoryDescriptor {
  exports: {
    default: React.ComponentType | any;
    documentation?: StoryDocumentation;
    frontmatter?: MDXFrontmatter;
  };
  filename: string;
}

interface TSStoryDescriptor {
  exports: Record<string, React.ComponentType | unknown>;
  filename: string;
}

export type StoryDescriptor = MDXStoryDescriptor | TSStoryDescriptor;

export function isMDXStory(story: StoryDescriptor): story is MDXStoryDescriptor {
  return story.filename.endsWith('.mdx');
}

async function importStory(filename: string): Promise<StoryDescriptor> {
  const loadStory = storyImports[filename];
  if (!loadStory) {
    throw new Error(`Unknown story: ${filename}`);
  }

  const story = (await loadStory()) as StoryDescriptor['exports'];
  return {
    exports: story,
    filename,
  };
}

interface UseStoriesLoaderOptions {
  files: string[];
}

export function useStoriesLoader(
  options: UseStoriesLoaderOptions
): UseQueryResult<StoryDescriptor[]> {
  const hmrVersion = useSyncExternalStore(subscribeToStoriesHmr, getStoriesHmrVersion);
  return useQuery({
    queryKey: [options.files, hmrVersion],
    queryFn: (): Promise<StoryDescriptor[]> => {
      return Promise.all(options.files.map(importStory));
    },
    enabled: options.files.length > 0,
  });
}
