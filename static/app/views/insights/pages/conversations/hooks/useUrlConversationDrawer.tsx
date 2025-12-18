import {useCallback} from 'react';

import useDrawer from 'sentry/components/globalDrawer';
import {
  ConversationDrawerUrlParams,
  useConversationDrawerQueryState,
} from 'sentry/views/insights/pages/conversations/utils/urlParams';

export function useUrlConversationDrawer() {
  const {
    openDrawer: baseOpenDrawer,
    closeDrawer: baseCloseDrawer,
    isDrawerOpen,
    panelRef,
  } = useDrawer();

  const [conversationDrawerQueryState, setConversationDrawerQueryState] =
    useConversationDrawerQueryState();

  const removeQueryParams = useCallback(() => {
    setConversationDrawerQueryState(null);
  }, [setConversationDrawerQueryState]);

  const closeDrawer = useCallback(() => {
    removeQueryParams();
    return baseCloseDrawer();
  }, [baseCloseDrawer, removeQueryParams]);

  const openDrawer = useCallback(
    (
      renderer: Parameters<typeof baseOpenDrawer>[0],
      options?: Parameters<typeof baseOpenDrawer>[1] & {
        conversationId?: string;
        spanId?: string;
        traceIds?: string[];
      }
    ) => {
      const {
        conversationId: optionsConversationId,
        spanId: optionsSpanId,
        traceIds: optionsTraceIds,
        onClose,
        ariaLabel,
        ...rest
      } = options || {};

      setConversationDrawerQueryState({
        conversationId: optionsConversationId,
        spanId: optionsSpanId,
        traceIds: optionsTraceIds,
      });

      return baseOpenDrawer(renderer, {
        ...rest,
        ariaLabel: ariaLabel || 'Conversation Drawer',
        shouldCloseOnLocationChange: nextLocation => {
          return !nextLocation.query[ConversationDrawerUrlParams.SELECTED_CONVERSATION];
        },
        onClose: () => {
          removeQueryParams();
          onClose?.();
        },
      });
    },
    [baseOpenDrawer, setConversationDrawerQueryState, removeQueryParams]
  );

  return {
    openDrawer,
    closeDrawer,
    isDrawerOpen,
    panelRef,
    drawerUrlState: conversationDrawerQueryState,
  };
}
