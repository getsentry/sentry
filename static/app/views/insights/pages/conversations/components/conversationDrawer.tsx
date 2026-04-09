import {memo, useCallback, useEffect} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {
  DrawerBody,
  DrawerHeader,
  useDrawerContentContext,
} from 'sentry/components/globalDrawer/components';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {ConversationDrawerOpenSource} from 'sentry/utils/analytics/conversationsAnalyticsEvents';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ConversationSummary} from 'sentry/views/insights/pages/conversations/components/conversationSummary';
import {ConversationViewContent} from 'sentry/views/insights/pages/conversations/components/conversationView';
import {
  useConversation,
  type UseConversationsOptions,
} from 'sentry/views/insights/pages/conversations/hooks/useConversation';
import {useUrlConversationDrawer} from 'sentry/views/insights/pages/conversations/hooks/useUrlConversationDrawer';
import {useConversationDrawerQueryState} from 'sentry/views/insights/pages/conversations/utils/urlParams';

const DRAWER_WIDTH = 900;

interface UseConversationViewDrawerProps {
  onClose?: () => void;
}

const ConversationDrawerContent = memo(function ConversationDrawerContent({
  conversation,
}: {
  conversation: UseConversationsOptions;
}) {
  const {nodes, nodeTraceMap, isLoading} = useConversation(conversation);
  const [conversationDrawerQueryState, setConversationDrawerQueryState] =
    useConversationDrawerQueryState();
  const selectedSpanId = conversationDrawerQueryState.spanId;
  const focusedTool = conversationDrawerQueryState.focusedTool;

  const handleSelectSpan = useCallback(
    (spanId: string) => {
      setConversationDrawerQueryState({
        spanId,
        focusedTool: null,
      });
    },
    [setConversationDrawerQueryState]
  );

  const {onClose} = useDrawerContentContext();

  return (
    <Flex direction="column" height="100%">
      <StyledDrawerHeader hideCloseButton>
        <Flex flex={1} justify="space-between" align="flex-start">
          <ConversationSummary
            nodes={nodes}
            nodeTraceMap={nodeTraceMap}
            conversationId={conversation.conversationId}
            isLoading={isLoading}
          />
          <Button
            priority="transparent"
            size="xs"
            aria-label={t('Close Drawer')}
            icon={<IconClose />}
            onClick={onClose}
          />
        </Flex>
      </StyledDrawerHeader>
      <StyledDrawerBody>
        <ConversationViewContent
          conversation={conversation}
          selectedSpanId={selectedSpanId}
          onSelectSpan={handleSelectSpan}
          focusedTool={focusedTool}
        />
      </StyledDrawerBody>
    </Flex>
  );
});

export function useConversationViewDrawer({
  onClose,
}: UseConversationViewDrawerProps = {}) {
  const organization = useOrganization();
  const {openDrawer, isDrawerOpen, drawerUrlState} = useUrlConversationDrawer();

  const openConversationViewDrawer = useCallback(
    ({
      conversation,
      source,
      focusedTool,
    }: {
      conversation: UseConversationsOptions;
      source: ConversationDrawerOpenSource;
      focusedTool?: string;
    }) => {
      trackAnalytics('conversations.drawer.open', {
        organization,
        source,
      });

      return openDrawer(() => <ConversationDrawerContent conversation={conversation} />, {
        ariaLabel: t('Conversation'),
        onClose,
        shouldCloseOnInteractOutside: () => true,
        drawerWidth: `${DRAWER_WIDTH}px`,
        drawerCss: css`
          min-width: ${DRAWER_WIDTH}px;
        `,
        resizable: true,
        conversationId: conversation.conversationId,
        startTimestamp: conversation.startTimestamp,
        endTimestamp: conversation.endTimestamp,
        focusedTool,
        drawerKey: 'conversation-view-drawer',
      });
    },
    [openDrawer, onClose, organization]
  );

  useEffect(() => {
    const {conversationId, startTimestamp, endTimestamp, focusedTool} = drawerUrlState;
    if (conversationId && !isDrawerOpen) {
      openConversationViewDrawer({
        conversation: {
          conversationId,
          startTimestamp: startTimestamp ?? undefined,
          endTimestamp: endTimestamp ?? undefined,
        },
        focusedTool: focusedTool ?? undefined,
        source: 'direct_link',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only run on mount
  }, []);

  return {
    openConversationViewDrawer,
    isConversationViewDrawerOpen: isDrawerOpen,
  };
}

const StyledDrawerHeader = styled(DrawerHeader)`
  padding-left: ${p => p.theme.space.xl};
`;

const StyledDrawerBody = styled(DrawerBody)`
  padding: 0;
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;
