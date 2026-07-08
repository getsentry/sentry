import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';

import {Placeholder} from 'sentry/components/placeholder';
import {
  ConversationTimelineLayout,
  SpanDetailCard,
} from 'sentry/views/explore/conversations/components/conversationLayout';

const TIMELINE_SKELETON_ROWS: Array<{
  title: string;
  indent?: boolean;
  secondary?: string;
}> = [
  {title: '130px', secondary: '90px'},
  {title: '90px', secondary: '60px', indent: true},
  {title: '110px', indent: true},
  {title: '80px', secondary: '100px', indent: true},
  {title: '85px', secondary: '55px', indent: true},
  {title: '120px', indent: true},
  {title: '100px', secondary: '70px'},
  {title: '95px', secondary: '85px', indent: true},
];

export function ConversationViewSkeletonNew() {
  return (
    <ConversationTimelineLayout
      left={<TimelineSkeleton />}
      right={<SpanDetailSkeleton />}
    />
  );
}

function TimelineSkeleton() {
  return (
    <Stack gap="xs">
      {TIMELINE_SKELETON_ROWS.map((row, index) => (
        <Container
          key={`${row.title}-${index}`}
          padding="xs"
          paddingLeft={row.indent ? 'xl' : 'xs'}
        >
          <Stack gap="xs">
            <Flex align="center" gap="md">
              <Placeholder height="16px" width="16px" />
              <Placeholder height="14px" width={row.title} />
              {/* Column widths mirror TimelineRow in aiSpanTimeline.tsx so the
               * layout doesn't shift when the real content loads. */}
              <Flex flex="1" minWidth="0">
                {row.secondary ? (
                  <Placeholder height="14px" width={row.secondary} />
                ) : null}
              </Flex>
              <Flex flexShrink={0} width="100px" justify="end">
                <Placeholder height="14px" width="48px" />
              </Flex>
              <Flex flexShrink={0} width="56px" justify="end">
                <Placeholder height="14px" width="40px" />
              </Flex>
            </Flex>
            <Placeholder height="4px" width="100%" />
          </Stack>
        </Container>
      ))}
    </Stack>
  );
}

function SpanDetailSkeleton() {
  return (
    <SpanDetailCard>
      <Flex align="center" gap="lg" flexShrink={0}>
        <Placeholder height="16px" width="16px" />
        <Placeholder height="16px" width="180px" />
      </Flex>
      <Stack gap="md" flexShrink={0}>
        <Placeholder height="16px" width="60px" />
        <Grid columns="max-content minmax(0, 1fr)" gap="md lg" align="center">
          <Placeholder height="14px" width="80px" />
          <Placeholder height="14px" width="200px" />
          <Placeholder height="14px" width="60px" />
          <Placeholder height="14px" width="160px" />
        </Grid>
      </Stack>
      {/* Mirrors the flat TabList: labels with no full-width divider. */}
      <Flex gap="lg" flexShrink={0}>
        <Placeholder height="16px" width="44px" />
        <Placeholder height="16px" width="56px" />
        <Placeholder height="16px" width="96px" />
      </Flex>
      <Placeholder height="240px" width="100%" />
    </SpanDetailCard>
  );
}
