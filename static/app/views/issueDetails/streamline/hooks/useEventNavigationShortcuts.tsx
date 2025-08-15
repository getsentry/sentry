import {useCallback} from 'react';

import {useComponentShortcuts} from 'sentry/utils/keyboardShortcuts';

interface UseEventNavigationShortcutsProps {
  onNavigateToLatest?: () => void;
  onNavigateToNext?: () => void;
  onNavigateToOldest?: () => void;
  onNavigateToPrevious?: () => void;
  onNavigateToRecommended?: () => void;
}

/**
 * Hook for event navigation shortcuts (j/k and numbered shortcuts)
 * Use this in components that handle event navigation
 */
export function useEventNavigationShortcuts({
  onNavigateToPrevious,
  onNavigateToNext,
  onNavigateToRecommended,
  onNavigateToLatest,
  onNavigateToOldest,
}: UseEventNavigationShortcutsProps) {
  const handlePreviousEvent = useCallback(() => {
    onNavigateToPrevious?.();
  }, [onNavigateToPrevious]);

  const handleNextEvent = useCallback(() => {
    onNavigateToNext?.();
  }, [onNavigateToNext]);

  const handleRecommendedEvent = useCallback(() => {
    onNavigateToRecommended?.();
  }, [onNavigateToRecommended]);

  const handleLatestEvent = useCallback(() => {
    onNavigateToLatest?.();
  }, [onNavigateToLatest]);

  const handleOldestEvent = useCallback(() => {
    onNavigateToOldest?.();
  }, [onNavigateToOldest]);

  useComponentShortcuts('issue-details-events', [
    {
      id: 'next-event',
      key: 'j',
      description: 'Next event',
      handler: handleNextEvent,
    },
    {
      id: 'previous-event',
      key: 'k',
      description: 'Previous event',
      handler: handlePreviousEvent,
    },
    {
      id: 'recommended-event',
      key: '1',
      description: 'Go to Recommended event',
      handler: handleRecommendedEvent,
    },
    {
      id: 'latest-event',
      key: '2',
      description: 'Go to Latest event',
      handler: handleLatestEvent,
    },
    {
      id: 'oldest-event',
      key: '3',
      description: 'Go to Oldest event',
      handler: handleOldestEvent,
    },
  ]);
}
