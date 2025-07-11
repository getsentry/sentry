import {useEffect} from 'react';
import kebabCase from 'lodash/kebabCase';

import {useStoryBookFilesByCategory} from 'sentry/stories/view/storySidebar';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

type LegacyStoryQuery = {
  name: string;
  category?: never;
  topic?: never;
};
type NewStoryQuery = {
  category: StoryCategory;
  topic: string;
  name?: never;
};

type StoryQuery = LegacyStoryQuery | NewStoryQuery;

export function useStoryRedirect() {
  const location = useLocation<StoryQuery>();
  const navigate = useNavigate();
  const stories = useStoryBookFilesByCategory();

  useEffect(() => {
    // If we already have a `storyPath` in state, bail out
    if (location.state?.storyPath) {
      return;
    }
    if (!location.pathname.startsWith('/stories')) {
      return;
    }
    const story = getStoryMeta(location.query, stories);
    if (!story) {
      return;
    }
    if (story.category === 'shared') {
      navigate(
        {pathname: `/stories/`, search: `?name=${encodeURIComponent(story.path)}`},
        {replace: true, state: {storyPath: story.path}}
      );
    } else {
      navigate(
        {pathname: `/stories/${story.category}/${kebabCase(story.label)}`},
        {replace: true, state: {storyPath: story.path}}
      );
    }
  }, [location, navigate, stories]);
}

type StoryCategory = keyof ReturnType<typeof useStoryBookFilesByCategory>;
interface StoryMeta {
  category: StoryCategory;
  label: string;
  path: string;
}

function getStoryMeta(
  query: StoryQuery,
  stories: ReturnType<typeof useStoryBookFilesByCategory>
) {
  if (query.name) {
    return legacyGetStoryMetaFromQuery(query, stories);
  }
  if (query.category && query.topic) {
    return getStoryMetaFromQuery(query, stories);
  }
  return undefined;
}

function legacyGetStoryMetaFromQuery(
  query: LegacyStoryQuery,
  stories: ReturnType<typeof useStoryBookFilesByCategory>
): StoryMeta | undefined {
  for (const category of Object.keys(stories) as StoryCategory[]) {
    const nodes = stories[category];
    for (const node of nodes) {
      const match = node.find(n => n.filesystemPath === query.name);
      if (match) {
        return {category, label: match.label, path: match.filesystemPath};
      }
    }
  }
  return undefined;
}

function getStoryMetaFromQuery(
  query: NewStoryQuery,
  stories: ReturnType<typeof useStoryBookFilesByCategory>
): StoryMeta | undefined {
  const {category, topic} = query;
  const nodes = stories[category];
  for (const node of nodes) {
    const match = node.find(n => kebabCase(n.label) === topic);
    if (match) {
      return {category, label: match.label, path: match.filesystemPath};
    }
  }
  return undefined;
}
