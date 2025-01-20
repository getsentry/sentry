import type React from 'react';
import {useMemo} from 'react';

import {useQuery, type UseQueryResult} from 'sentry/utils/queryClient';

const context = require.context('sentry', true, /\.stories.tsx$/, 'lazy');

export interface StoryDescriptor {
  exports: Record<string, React.ComponentType | any>;
  filename: string;
}

export function useStoryBookFiles() {
  return useMemo(() => context.keys().map(file => file.replace(/^\.\//, 'app/')), []);
}

async function importStory(filename: string): Promise<StoryDescriptor> {
  const story = await context(filename.replace(/^app\//, './'));

  return {
    exports: story,
    filename,
  };
}

type StoriesResult<T> = T extends string ? StoryDescriptor : StoryDescriptor[];

interface UseStoriesLoaderOptions<T extends string | string[]> {
  filename: T;
}

export default function useStoriesLoader<T extends string | string[]>(
  options: UseStoriesLoaderOptions<T>
): UseQueryResult<StoriesResult<T>, Error> {
  return useQuery({
    queryKey: [options.filename],
    queryFn: (): Promise<StoriesResult<T>> => {
      if (Array.isArray(options.filename)) {
        return Promise.all(options.filename.map(importStory)) as Promise<
          StoriesResult<T>
        >;
      }

      return importStory(options.filename) as Promise<StoriesResult<T>>;
    },
    enabled: !!options.filename,
  });
}
