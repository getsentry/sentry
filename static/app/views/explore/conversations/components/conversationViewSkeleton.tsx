import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';

import {Placeholder} from 'sentry/components/placeholder';
import {ConversationTimelineLayout} from 'sentry/views/explore/conversations/components/conversationLayout';

const TIMELINE_SKELETON_ROWS: Array<{
  indent: boolean;
  secondary: string | null;
  title: string;
}> = [
  {title: '130px', secondary: '90px', indent: false},
  {title: '90px', secondary: '60px', indent: true},
  {title: '110px', secondary: null, indent: true},
  {title: '80px', secondary: '100px', indent: true},
  {title: '85px', secondary: '55px', indent: true},
  {title: '120px', secondary: null, indent: true},
  {title: '100px', secondary: '70px', indent: false},
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
              {row.secondary ? <Placeholder height="14px" width={row.secondary} /> : null}
              <Flex flex="1" justify="end" gap="md">
                <Placeholder height="14px" width="48px" />
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
    <Stack
      background="primary"
      border="primary"
      radius="md"
      padding="xl"
      gap="lg"
      flex="1"
      minWidth="0"
      minHeight="0"
      height={{xs: 'auto', sm: '100%'}}
    >
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
      <Flex gap="lg" flexShrink={0} borderBottom="primary" paddingBottom="sm">
        <Placeholder height="16px" width="40px" />
        <Placeholder height="16px" width="48px" />
        <Placeholder height="16px" width="72px" />
      </Flex>
      <Placeholder height="240px" width="100%" />
    </Stack>
  );
}
