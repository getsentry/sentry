import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import {IconArrow} from 'sentry/icons';
import {useStoryBookFilesByCategory} from 'sentry/stories/view/storySidebar';
import type {StoryTreeNode} from 'sentry/stories/view/storyTree';
import type {StoryDescriptor} from 'sentry/stories/view/useStoriesLoader';
import {useStory} from 'sentry/stories/view/useStory';
import {space} from 'sentry/styles/space';

export function StoryFooter() {
  const {story} = useStory();
  const categories = useStoryBookFilesByCategory();
  const pagination = findPreviousAndNextStory(story, categories);

  return (
    <Flex align="center" justify="space-between" gap={space(2)}>
      {pagination?.prev && (
        <Card to={pagination.prev.story.location} icon={<IconArrow direction="left" />}>
          <CardLabel>Previous</CardLabel>
          <CardTitle>{pagination.prev.story.label}</CardTitle>
        </Card>
      )}
      {pagination?.next && (
        <Card
          data-flip
          to={pagination.next.story.location}
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
  const stories = Object.entries(categories).flatMap(([key, category]) =>
    category.map(s => ({category: key, story: s}))
  );

  const currentIndex = stories.findIndex(s => s.story.filesystemPath === story.filename);

  if (currentIndex === -1) {
    return null;
  }

  return {
    prev: stories[currentIndex - 1] ?? undefined,
    next: stories[currentIndex + 1] ?? undefined,
  };
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
