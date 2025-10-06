import {Flex, Grid, Stack} from 'sentry/components/core/layout';
import {Slab} from 'sentry/components/core/layout/layer';
import {Link} from 'sentry/components/core/link';
import {Text} from 'sentry/components/core/text';
import {IconArrow} from 'sentry/icons';

import {useStoryBookFilesByCategory} from './storySidebar';
import type {StoryTreeNode} from './storyTree';
import {type StoryDescriptor} from './useStoriesLoader';
import {useStory} from './useStory';

export function StoryFooter() {
  const {story} = useStory();
  const stories = useStoryBookFilesByCategory();
  const pagination = findPreviousAndNextStory(story, stories);

  return (
    <Grid align="center" justify="between" gap="xl" columns="1fr 1fr">
      {pagination?.prev ? (
        <Slab padding="xl" display="block">
          {props => {
            return (
              <Link {...props} to={pagination.prev?.location ?? ''}>
                <Flex gap="md" justify="start" align="center">
                  <Flex align="center" padding="md">
                    <IconArrow direction="left" color="textColor" />
                  </Flex>
                  <Stack gap="md">
                    <Text variant="muted" as="div" bold>
                      Previous
                    </Text>
                    <Text size="xl" as="div" bold wrap="nowrap">
                      {pagination.prev?.label}
                    </Text>
                  </Stack>
                </Flex>
              </Link>
            );
          }}
        </Slab>
      ) : null}
      {pagination?.next ? (
        <Slab padding="xl" display="block">
          {props => {
            return (
              <Link {...props} to={pagination.next?.location ?? ''}>
                <Flex gap="md" justify="end" align="center">
                  <Stack gap="md">
                    <Text variant="muted" as="div" align="right" bold>
                      Next
                    </Text>
                    <Text size="xl" as="div" align="right" bold wrap="nowrap">
                      {pagination.next?.label}
                    </Text>
                  </Stack>
                  <Flex align="center" padding="md">
                    <IconArrow direction="right" color="textColor" />
                  </Flex>
                </Flex>
              </Link>
            );
          }}
        </Slab>
      ) : null}
    </Grid>
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

// const Card = styled(LinkButton)`
//   display: flex;
//   flex-direction: column;
//   flex: 1;
//   height: 80px;
//   margin-bottom: ${p => p.theme.space['3xl']};
//   span:last-child {
//     width: 100%;
//     display: grid;
//     grid-template-areas:
//       'icon label'
//       'icon text';
//     grid-template-columns: auto 1fr;
//     place-content: center;
//     gap: ${p => p.theme.space.md} ${p => p.theme.space.xl};
//   }
//   &[data-flip] span:last-child {
//     grid-template-areas:
//       'label icon'
//       'text icon';
//     grid-template-columns: 1fr auto;
//     justify-content: flex-end;
//   }
//   span:has(svg) {
//     grid-area: icon;
//   }
// `;
