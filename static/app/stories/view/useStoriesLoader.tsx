import type React from 'react';
import {useMemo} from 'react';

import {useQuery, type UseQueryResult} from 'sentry/utils/queryClient';

const context = require.context('sentry', true, /\.stories.tsx$/, 'lazy');
const mdxContext = require.context('sentry', true, /\.mdx$/, 'lazy');

interface MDXStoryDescriptor {
  exports: {
    default: React.ComponentType | any;
  };
  filename: string;
}

interface TSStoryDescriptor {
  exports: Record<string, React.ComponentType | any>;
  filename: string;
}

export type StoryDescriptor = MDXStoryDescriptor | TSStoryDescriptor;

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
    enabled: !!options.files,
  });
}
