import type React from 'react';
import {useMemo} from 'react';

import {useQuery} from 'sentry/utils/queryClient';

const context = require.context('sentry', true, /\.stories.tsx$/, 'lazy');

interface UseStoriesLoaderOptions {
  filename: string;
}

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

export default function useStoriesLoader({filename}: UseStoriesLoaderOptions) {
  return useQuery({
    queryKey: [filename],
    queryFn: () => importStory(filename),
  });
}
