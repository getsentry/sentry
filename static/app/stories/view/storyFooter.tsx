import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import {IconArrow} from 'sentry/icons';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useOrganization from 'sentry/utils/useOrganization';

import {useStoryBookFilesByCategory} from './storySidebar';
import type {StoryTreeNode} from './storyTree';
import {type StoryDescriptor} from './useStoriesLoader';
import {useStory} from './useStory';

export function StoryFooter() {
  const {story} = useStory();
  const stories = useStoryBookFilesByCategory();
  const pagination = findPreviousAndNextStory(story, stories);
  const organization = useOrganization();

  return (
    <Flex align="center" justify="between" gap="xl">
      {pagination?.prev && (
        <Card
          to={{
            pathname: normalizeUrl(
              `/organizations/${organization.slug}/stories/${pagination.prev.category}/${pagination.prev.slug}/`
            ),
          }}
          icon={<IconArrow direction="left" />}
        >
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
          to={{
            pathname: normalizeUrl(
              `/organizations/${organization.slug}/stories/${pagination.next.category}/${pagination.next.slug}/`
            ),
          }}
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
  const queue: StoryTreeNode[] = [];

  function processNode(node: StoryTreeNode) {
    for (const key in node.children) {
      processNode(node.children[key]!);
    }
    if (!Object.keys(node.children).length) {
      queue.push(node);
    }
  }

  for (const node of stories) {
    processNode(node);
  }

  for (let i = 0; i < queue.length; i++) {
    const node = queue[i];
    if (!node) break;

    if (node.filesystemPath === story.filename) {
      return {
        prev: queue[i - 1],
        next: queue[i + 1],
      };
    }
  }

  return null;
}

const Card = styled(LinkButton)`
  display: flex;
  flex-direction: column;
  flex: 1;
  height: 80px;
  margin-bottom: ${p => p.theme.space['3xl']};
  span:last-child {
    width: 100%;
    display: grid;
    grid-template-areas:
      'icon label'
      'icon text';
    grid-template-columns: auto 1fr;
    place-content: center;
    gap: ${p => p.theme.space.md} ${p => p.theme.space.xl};
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
