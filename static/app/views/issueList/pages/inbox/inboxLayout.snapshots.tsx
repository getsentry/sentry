import {Container, Stack} from '@sentry/scraps/layout';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';
import {Heading, Text} from '@sentry/scraps/text';

import {InboxLayout} from './inboxLayout';

function ExampleInbox({
  inboxWidth = 480,
  isDesktop = true,
  showEmptyState = false,
}: {
  inboxWidth?: number;
  isDesktop?: boolean;
  showEmptyState?: boolean;
}) {
  return (
    <Text as="div">
      <Stack height="400px" background="secondary">
        <InboxLayout
          isDesktop={isDesktop}
          hasSelectedIssue={false}
          showEmptyState={showEmptyState}
          inboxWidth={inboxWidth}
          assignmentTabs={
            <SegmentedControl size="xs" value="me" onChange={() => {}}>
              <SegmentedControl.Item key="me">Me</SegmentedControl.Item>
              <SegmentedControl.Item key="all">All</SegmentedControl.Item>
            </SegmentedControl>
          }
          preview={
            <Container padding="xl">
              <Heading as="h2" size="lg">
                {showEmptyState ? 'No Issues in your Inbox!' : 'Issue preview'}
              </Heading>
            </Container>
          }
        >
          {['Fix Proposed', 'Diagnosed', 'Assigned', 'Fix Applied'].map(section => (
            <Container key={section} padding="lg" borderBottom="muted">
              <Heading as="h3" size="md">
                {section}
              </Heading>
            </Container>
          ))}
        </InboxLayout>
      </Stack>
    </Text>
  );
}

describe('InboxLayout', () => {
  it.snapshot(
    'reserves the inbox column without a preview or empty state',
    () => <ExampleInbox />,
    {viewport: 1200, tags: {area: 'core'}}
  );

  it.snapshot(
    'reserves the persisted inbox width without a preview',
    () => <ExampleInbox inboxWidth={550} />,
    {viewport: 1200, tags: {area: 'core'}}
  );

  it.snapshot(
    'fills a narrow container without a preview or empty state',
    () => <ExampleInbox isDesktop={false} />,
    {viewport: 803, tags: {area: 'core'}}
  );

  it.snapshot(
    'shows the empty state beside the inbox',
    () => <ExampleInbox isDesktop={false} showEmptyState />,
    {viewport: 900, tags: {area: 'core'}}
  );
});
