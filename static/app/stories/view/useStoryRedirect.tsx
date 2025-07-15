import {useLayoutEffect} from 'react';
import kebabCase from 'lodash/kebabCase';

import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useParams} from 'sentry/utils/useParams';

import {useStoryBookFilesByCategory} from './storySidebar';
import type {StoryCategory, StoryTreeNode} from './storyTree';

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
    const story = getStory(stories, {query: location.query, params});
    if (!story) {
      return;
    }
    const {state, ...to} = story.location;
    navigate(to, {replace: true, state});
  }, [location, params, navigate, stories]);
}

interface StoryRouteContext {
  params: StoryParams;
  query: LegacyStoryQuery;
}

function getStory(
  stories: ReturnType<typeof useStoryBookFilesByCategory>,
  context: StoryRouteContext
) {
  if (context.params.storyType && context.params.storySlug) {
    return getStoryFromParams(stories, context);
  }
  if (context.query.name) {
    return legacyGetStoryFromQuery(stories, context);
  }
  return undefined;
}

function legacyGetStoryFromQuery(
  stories: ReturnType<typeof useStoryBookFilesByCategory>,
  context: StoryRouteContext
): StoryTreeNode | undefined {
  for (const category of Object.keys(stories) as StoryCategory[]) {
    const nodes = stories[category];
    for (const node of nodes) {
      const match = node.find(n => n.filesystemPath === context.query.name);
      if (match) {
        return match;
      }
    }
  }
  return undefined;
}

function getStoryFromParams(
  stories: ReturnType<typeof useStoryBookFilesByCategory>,
  context: StoryRouteContext
): StoryTreeNode | undefined {
  const {storyType: category, storySlug} = context.params;
  const nodes =
    category && category in stories ? stories[category as keyof typeof stories] : [];
  for (const node of nodes) {
    const match = node.find(n => kebabCase(n.label) === storySlug);
    if (match) {
      return match;
    }
  }
  return undefined;
}
