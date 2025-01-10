import type React from 'react';

import {useQuery} from 'sentry/utils/queryClient';
import storiesContext from 'sentry/views/stories/storiesContext';

interface UseStoriesLoaderOptions {
  filename: string;
}

export interface StoryDescriptor {
  exports: Record<string, React.ComponentType | any>;
  filename: string;
}

function importStory(filename: string): Promise<StoryDescriptor> {
  return storiesContext()
    .importStory(filename)
    .then((story): StoryDescriptor => {
      return {
        filename,
        exports: story,
      };
    });
}

export default function useStoriesLoader({filename}: UseStoriesLoaderOptions) {
  return useQuery({
    queryKey: [filename],
    queryFn: () => importStory(filename),
  });
}
