import type {Ref} from 'react';

import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {t} from 'sentry/locale';

export function InboxLayout({
  assignmentTabs,
  children,
  hasSelectedIssue,
  inboxRef,
  inboxWidth,
  isDesktop,
  preview,
  resizeHandle,
  showEmptyState,
}: {
  assignmentTabs: React.ReactNode;
  children: React.ReactNode;
  hasSelectedIssue: boolean;
  inboxWidth: number;
  isDesktop: boolean;
  preview: React.ReactNode;
  showEmptyState: boolean;
  inboxRef?: Ref<HTMLDivElement>;
  resizeHandle?: (props: {className: string}) => React.ReactNode;
}) {
  const isSplitView = isDesktop || showEmptyState;
  const showPreviewPane = hasSelectedIssue || showEmptyState;

  return (
    <Grid
      flex={1}
      minHeight={0}
      columns={isSplitView ? 'max-content minmax(0, 1fr)' : 'minmax(0, 1fr)'}
    >
      <Stack
        ref={isSplitView ? inboxRef : undefined}
        as="section"
        aria-label={t('Issue inbox')}
        position="relative"
        // useResizable writes an inline width, so the full-width state must override it inline.
        style={{width: isSplitView ? `${inboxWidth}px` : '100%'}}
        minWidth={0}
        minHeight={0}
        display={hasSelectedIssue && !isDesktop ? 'none' : 'flex'}
        background="primary"
        borderRight={isSplitView ? 'muted' : undefined}
      >
        <Flex
          as="header"
          align="center"
          justify="between"
          padding="md lg"
          background="secondary"
          borderBottom="muted"
          flexShrink={0}
        >
          <Heading as="h2" size="md">
            {t('Issues')}
          </Heading>
          {assignmentTabs}
        </Flex>
        <Stack flex={1} minHeight={0} overflowY="auto" overscrollBehavior="contain">
          {children}
        </Stack>
        <Container
          top="0"
          right="0"
          bottom="0"
          width="8px"
          radius="lg"
          position="absolute"
          display={isSplitView ? 'block' : 'none'}
        >
          {props => resizeHandle?.(props)}
        </Container>
      </Stack>
      <Stack
        as="aside"
        aria-label={t('Issue preview')}
        flex={1}
        minWidth={0}
        minHeight={0}
        overflow="hidden"
        display={showPreviewPane ? 'flex' : 'none'}
      >
        {preview}
      </Stack>
    </Grid>
  );
}
