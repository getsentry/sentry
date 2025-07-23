import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import {IconArrow} from 'sentry/icons';
import {space} from 'sentry/styles/space';

import {useStoryBookFilesByCategory} from './storySidebar';
import type {StoryTreeNode} from './storyTree';
import {type StoryDescriptor} from './useStoriesLoader';
import {useStory} from './useStory';

export function StoryFooter() {
  const {story} = useStory();
  const stories = useStoryBookFilesByCategory();
  const pagination = findPreviousAndNextStory(story, stories);

  return (
    <Flex align="center" justify="space-between" gap="xl">
      {pagination?.prev && (
        <Card to={pagination.prev.location} icon={<IconArrow direction="left" />}>
          <Text variant="muted" as="div">
            Previous
          </Text>
          <Text size="xl" as="div">
            {pagination.prev.label}
          </Text>
        </Card>
      )}
      {pagination?.next && (
        <Card
          data-flip
          to={pagination.next.location}
          icon={<IconArrow direction="right" />}
        >
          <Text variant="muted" as="div" align="right">
            Next
          </Text>
          <Text size="xl" as="div" align="right">
            {pagination.next.label}
          </Text>
        </Card>
      )}
    </Flex>
  );
}

function findPreviousAndNextStory(
  story: StoryDescriptor,
  categories: ReturnType<typeof useStoryBookFilesByCategory>
): {
  next?: StoryTreeNode;
  prev?: StoryTreeNode;
} | null {
  const stories = Object.values(categories).flat();
  const currentIndex = stories.findIndex(s => s.filesystemPath === story.filename);

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
  }
  span:has(svg) {
    grid-area: icon;
  }
`;
