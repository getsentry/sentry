import {useLayoutEffect} from 'react';
import kebabCase from 'lodash/kebabCase';

import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useParams} from 'sentry/utils/useParams';

import {useStoryBookFilesByCategory} from './storySidebar';
import type {StoryCategory} from './storyTree';

type LegacyStoryQuery = {
  name: string;
};
interface StoryParams {
  storySlug: string;
  storyType: StoryCategory;
}

export function useStoryRedirect() {
  const location = useLocation<LegacyStoryQuery>();
  const params = useParams<StoryParams>();
  const navigate = useNavigate();
  const stories = useStoryBookFilesByCategory();

  useLayoutEffect(() => {
    // If we already have a `storyPath` in state, bail out
    if (location.state?.storyPath) {
      return;
    }
    if (!location.pathname.startsWith('/stories')) {
      return;
    }
    const story = getStoryMeta(stories, {query: location.query, params});
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
  }, [location, params, navigate, stories]);
}

interface StoryRouteContext {
  params: StoryParams;
  query: LegacyStoryQuery;
}

interface StoryMeta {
  category: StoryCategory;
  label: string;
  path: string;
}

function getStoryMeta(
  stories: ReturnType<typeof useStoryBookFilesByCategory>,
  context: StoryRouteContext
) {
  if (context.params.storyType && context.params.storySlug) {
    return getStoryMetaFromParams(stories, context);
  }
  if (context.query.name) {
    return legacyGetStoryMetaFromQuery(stories, context);
  }
  return undefined;
}

function legacyGetStoryMetaFromQuery(
  stories: ReturnType<typeof useStoryBookFilesByCategory>,
  context: StoryRouteContext
): StoryMeta | undefined {
  for (const category of Object.keys(stories) as StoryCategory[]) {
    const nodes = stories[category];
    for (const node of nodes) {
      const match = node.find(n => n.filesystemPath === context.query.name);
      if (match) {
        return {category, label: match.label, path: match.filesystemPath};
      }
    }
  }
  return undefined;
}

function getStoryMetaFromParams(
  stories: ReturnType<typeof useStoryBookFilesByCategory>,
  context: StoryRouteContext
): StoryMeta | undefined {
  const {storyType: category, storySlug} = context.params;
  const nodes =
    category && category in stories ? stories[category as keyof typeof stories] : [];
  for (const node of nodes) {
    const match = node.find(n => kebabCase(n.label) === storySlug);
    if (match) {
      return {category, label: match.label, path: match.filesystemPath};
    }
  }
  return undefined;
}
