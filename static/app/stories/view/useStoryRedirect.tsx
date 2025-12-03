import {useLayoutEffect} from 'react';
import kebabCase from 'lodash/kebabCase';

import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useParams} from 'sentry/utils/useParams';

import type {StoryCategory, StoryTreeNode} from './storyTree';
import {useFlatStoryList} from './storyTree';

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
  const stories = useFlatStoryList();

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
    navigate(
      {pathname: location.pathname, hash: location.hash, ...to},
      {replace: true, state: {...location.state, ...state}}
    );
  }, [location, params, navigate, stories]);
}

interface StoryRouteContext {
  params: StoryParams;
  query: LegacyStoryQuery;
}

function getStory(
  stories: StoryTreeNode[],
  context: StoryRouteContext
): StoryTreeNode | undefined {
  if (context.params.storyType && context.params.storySlug) {
    return getStoryFromParams(stories, context);
  }
  if (context.query.name) {
    return legacyGetStoryFromQuery(stories, context);
  }
  return undefined;
}

function legacyGetStoryFromQuery(
  stories: StoryTreeNode[],
  context: StoryRouteContext
): StoryTreeNode | undefined {
  for (const node of stories) {
    const match = node.find(n => n.filesystemPath === context.query.name);
    if (match) {
      return match;
    }
  }
  return undefined;
}

function getStoryFromParams(
  stories: StoryTreeNode[],
  context: StoryRouteContext
): StoryTreeNode | undefined {
  const {storyType: category, storySlug} = context.params;

  for (const node of stories) {
    // Match by category and slug
    if (node.category === category && kebabCase(node.label) === storySlug) {
      return node;
    }
    // Also search children for nested nodes
    const match = node.find(
      n => n.category === category && kebabCase(n.label) === storySlug
    );
    if (match) {
      return match;
    }
  }
  return undefined;
}
