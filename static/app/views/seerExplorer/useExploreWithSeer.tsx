import {useCallback} from 'react';

import {useSeerExplorer} from 'sentry/views/seerExplorer/hooks/useSeerExplorer';
import {useOpenExplorerPanel} from 'sentry/views/seerExplorer/useExplorerPanel';

/**
 * Hook that returns a function to open Seer Explorer and start a new session
 * with the given message.
 *
 * @example
 * ```tsx
 * const exploreWithSeer = useExploreWithSeer();
 *
 * <Button onClick={() => exploreWithSeer('Investigate this...')}>
 *   Explore with Seer
 * </Button>
 * ```
 */
export function useExploreWithSeer() {
  const openPanel = useOpenExplorerPanel();
  const {startNewSession, sendMessage} = useSeerExplorer();

  return useCallback(
    (message: string) => {
      // Open the panel
      openPanel();

      // Start new session and send the message
      startNewSession();
      setTimeout(() => {
        sendMessage(message, undefined);
      }, 50);
    },
    [openPanel, startNewSession, sendMessage]
  );
}
