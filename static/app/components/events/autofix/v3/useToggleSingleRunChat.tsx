import {useCallback} from 'react';

import {
  useSeerExplorerChatDispatch,
  useSeerExplorerChatState,
} from 'sentry/views/seerExplorer/seerExplorerChatStateContext';
import type {SeerExplorerRunId} from 'sentry/views/seerExplorer/types';
import {useSeerExplorerContext} from 'sentry/views/seerExplorer/useSeerExplorerContext';

export function useOpenSingleRunChat() {
  const {openSeerExplorer} = useSeerExplorerContext();
  const dispatch = useSeerExplorerChatDispatch();

  return useCallback(
    (runId: SeerExplorerRunId) => {
      dispatch({type: 'set run id', payload: runId});
      openSeerExplorer({runId});
    },
    [dispatch, openSeerExplorer]
  );
}

export function useIsSingleRunChatOpen(runId: SeerExplorerRunId | undefined) {
  const {isOpen} = useSeerExplorerContext();
  const {runId: openRunId} = useSeerExplorerChatState();
  return runId !== undefined && isOpen && String(openRunId) === String(runId);
}

export function useToggleSingleRunChat(runId: SeerExplorerRunId | undefined) {
  const {closeSeerExplorer} = useSeerExplorerContext();
  const isChatOpen = useIsSingleRunChatOpen(runId);
  const openSingleRunChat = useOpenSingleRunChat();

  return useCallback(() => {
    if (runId === undefined) {
      return;
    }
    if (isChatOpen) {
      closeSeerExplorer();
    } else {
      openSingleRunChat(runId);
    }
  }, [runId, isChatOpen, openSingleRunChat, closeSeerExplorer]);
}
