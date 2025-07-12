import styled from '@emotion/styled';
import qs from 'query-string';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import {IconArrow} from 'sentry/icons';
import {useStoryBookFilesByCategory} from 'sentry/stories/view/storySidebar';
import type {StoryTreeNode} from 'sentry/stories/view/storyTree';
import type {StoryDescriptor} from 'sentry/stories/view/useStoriesLoader';
import {useStory} from 'sentry/stories/view/useStory';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';

export function StoryFooter() {
  const location = useLocation();

  const {story} = useStory();
  const categories = useStoryBookFilesByCategory();
  const pagination = findPreviousAndNextStory(story, categories);

  const prevLocationDescriptor = qs.stringify({
    ...location.query,
    name: pagination?.prev?.story.filesystemPath,
  });
  const nextLocationDescriptor = qs.stringify({
    ...location.query,
    name: pagination?.next?.story.filesystemPath,
  });

  return (
    <Flex align="center" justify="space-between" gap={space(2)}>
      {pagination?.prev && (
        <Card
          to={`/stories/?${prevLocationDescriptor}`}
          icon={<IconArrow direction="left" />}
        >
          <CardLabel>Previous</CardLabel>
          <CardTitle>{pagination.prev.story.label}</CardTitle>
        </Card>
      )}
      {pagination?.next && (
        <Card
          data-flip
          to={`/stories/?${nextLocationDescriptor}`}
          icon={<IconArrow direction="right" />}
        >
          <CardLabel>Next</CardLabel>
          <CardTitle>{pagination.next.story.label}</CardTitle>
        </Card>
      )}
    </Flex>
  );
}

function findPreviousAndNextStory(
  story: StoryDescriptor,
  categories: ReturnType<typeof useStoryBookFilesByCategory>
): {
  next: {category: string; story: StoryTreeNode} | undefined;
  prev: {category: string; story: StoryTreeNode} | undefined;
} | null {
  let prev: {category: string; story: StoryTreeNode} | undefined;
  let next: {category: string; story: StoryTreeNode} | undefined;

  const stories: Array<{category: string; story: StoryTreeNode}> = [];

  // Flatten into a single list so we don't have to deal with overflowing index
  // categories and can simplify the search procedure.
  for (const key in categories) {
    const category = categories[key as keyof typeof categories];
    for (const s of category) {
      stories.push({category: key, story: s});
    }
  }

  for (let i = 0; i < stories.length; i++) {
    const s = stories[i]!;
    if (s.story.filesystemPath === story.filename) {
      prev = stories[i - 1];
      next = stories[i + 1];
      return {prev, next};
    }
  }

  return null;
}

const Card = styled(LinkButton)`
  display: flex;
  flex-direction: column;
  flex: 1;
  height: 80px;
  margin-bottom: ${space(4)};
  span:last-child {
    width: 100%;
    display: grid;
    grid-template-areas:
      'icon label'
      'icon text';
    grid-template-columns: auto 1fr;
    place-content: center;
    gap: ${space(1)} ${space(2)};
  }
  &[data-flip] span:last-child {
    grid-template-areas:
      'label icon'
      'text icon';
    grid-template-columns: 1fr auto;
    justify-content: flex-end;
    text-align: right;
  }
  span:has(svg) {
    grid-area: icon;
  }
`;
const CardLabel = styled('div')`
  color: ${p => p.theme.tokens.content.muted};
`;
const CardTitle = styled('div')`
  color: ${p => p.theme.tokens.content.primary};
  font-size: 20px;
`;
