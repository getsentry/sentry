import {useCallback} from 'react';

import {useComponentShortcuts} from 'sentry/utils/keyboardShortcuts';

interface UseDrawerShortcutsProps {
  onOpenActivityDrawer?: () => void;
  onOpenDistributionsDrawer?: () => void;
  onOpenSimilarIssuesDrawer?: () => void;
  onOpenMergedIssuesDrawer?: () => void;
  onOpenSeerDrawer?: () => void;
}

/**
 * Hook for drawer/sidebar shortcuts
 * Use this in components that can open drawers (like StreamlinedSidebar)
 */
export function useDrawerShortcuts({
  onOpenActivityDrawer,
  onOpenDistributionsDrawer,
  onOpenSimilarIssuesDrawer,
  onOpenMergedIssuesDrawer,
  onOpenSeerDrawer,
}: UseDrawerShortcutsProps) {
  
  const handleOpenActivityDrawer = useCallback(() => {
    onOpenActivityDrawer?.();
  }, [onOpenActivityDrawer]);

  const handleOpenDistributionsDrawer = useCallback(() => {
    onOpenDistributionsDrawer?.();
  }, [onOpenDistributionsDrawer]);

  const handleOpenSimilarIssuesDrawer = useCallback(() => {
    onOpenSimilarIssuesDrawer?.();
  }, [onOpenSimilarIssuesDrawer]);

  const handleOpenMergedIssuesDrawer = useCallback(() => {
    onOpenMergedIssuesDrawer?.();
  }, [onOpenMergedIssuesDrawer]);

  const handleOpenSeerDrawer = useCallback(() => {
    onOpenSeerDrawer?.();
  }, [onOpenSeerDrawer]);

  useComponentShortcuts('issue-details-drawers', [
    {
      id: 'open-activity',
      key: 'c',
      description: 'Open Activity drawer (comments)',
      handler: handleOpenActivityDrawer,
    },
    {
      id: 'open-distributions',
      key: 'd',
      description: 'Open Distributions drawer (tags)',
      handler: handleOpenDistributionsDrawer,
    },
    {
      id: 'open-merged-issues',
      key: 'm',
      description: 'Open Merged Issues drawer',
      handler: handleOpenMergedIssuesDrawer,
    },
    {
      id: 'open-similar-issues',
      key: 'shift+s',
      description: 'Open Similar Issues drawer', 
      handler: handleOpenSimilarIssuesDrawer,
    },
    {
      id: 'open-seer-analysis',
      key: 'shift+a',
      description: 'Open Seer Analysis drawer',
      handler: handleOpenSeerDrawer,
    },
  ]);
}