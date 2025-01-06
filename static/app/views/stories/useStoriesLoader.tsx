import {useQuery} from 'sentry/utils/queryClient';
import storiesContext from 'sentry/views/stories/storiesContext';
import type {ResolvedStoryModule} from 'sentry/views/stories/types';

interface UseStoriesLoaderOptions {
  filename: string;
}

interface StoryDescriptor {
  filename: string;
  resolved: ResolvedStoryModule;
}

function importStory(filename: string): Promise<StoryDescriptor> {
  return storiesContext()
    .importStory(filename)
    .then(story => ({
      filename,
      resolved: story,
    }));
}

export default function useStoriesLoader({filename}: UseStoriesLoaderOptions) {
  return useQuery({
    queryKey: [filename],
    queryFn: () => importStory(filename),
  });
}
