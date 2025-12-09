import type React from 'react';
import {useMemo} from 'react';

import {useQuery, type UseQueryResult} from 'sentry/utils/queryClient';

const context = require.context('sentry', true, /\.stories.tsx$/, 'lazy');
const mdxContext = require.context('sentry', true, /\.mdx$/, 'lazy');

export interface StoryResources {
  a11y?: Record<string, string>;
  figma?: string;
  js?: string;
}

export interface MDXStoryDescriptor {
  exports: {
    default: React.ComponentType | any;
    documentation?: TypeLoader.TypeLoaderResult;
    frontmatter?: {
      description: string;
      title: string;
      layout?: 'document';
      resources?: StoryResources;
      source?: string;
      status?: 'in-progress' | 'experimental' | 'stable';
      types?: string;
    };
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

export function useStoryBookFiles() {
  return useMemo(
    () =>
      [...context.keys(), ...mdxContext.keys()].map(file =>
        file.replace(/^\.\//, 'app/')
      ),
    []
  );
}

async function importStory(filename: string): Promise<StoryDescriptor> {
  if (!filename) {
    throw new Error(`Filename is required, got ${filename}`);
  }

  if (filename.endsWith('.mdx')) {
    const story = await mdxContext(filename.replace(/^app\//, './'));
    return {
      exports: story,
      filename,
    };
  }

  const story = await context(filename.replace(/^app\//, './'));
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
): UseQueryResult<StoryDescriptor[], Error> {
  return useQuery({
    queryKey: [options.files],
    queryFn: (): Promise<StoryDescriptor[]> => {
      return Promise.all(options.files.map(importStory));
    },
    enabled: options.files.length > 0,
  });
}
