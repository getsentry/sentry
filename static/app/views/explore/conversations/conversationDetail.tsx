import type React from 'react';

import {Container, Flex} from '@sentry/scraps/layout';

import {ConversationDetailPageNew} from 'sentry/views/explore/conversations/conversationDetailNew';

function ConversationDetailPage() {
  return <ConversationDetailPageNew />;
}

export function ConversationViewContainer({children}: {children: React.ReactNode}) {
  return (
    <Container
      flex={1}
      minHeight="0"
      overflow="hidden"
      background="primary"
      display="flex"
    >
      {/*
       * No explicit `height: 100%` here: the parent Container is a flex row
       * with the default `align-items: stretch`, so this pane already fills the
       * available height. A `height: 100%` would resolve against the parent's
       * height, which is indefinite when the app is in its mobile (column)
       * layout — every browser then collapses this subtree to zero height,
       * leaving the conversation detail view blank. (TET-2690)
       */}
      <Flex flex={1} minWidth="0" minHeight="0">
        {children}
      </Flex>
    </Container>
  );
}

export default ConversationDetailPage;
