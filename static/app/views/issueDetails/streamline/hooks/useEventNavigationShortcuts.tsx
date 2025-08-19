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
      key: 'l',
      description: 'Next event',
      handler: handleNextEvent,
    },
    {
      id: 'previous-event',
      key: 'h',
      description: 'Previous event',
      handler: handlePreviousEvent,
    },
    {
      id: 'recommended-event',
      key: ';',
      description: 'Go to Recommended event',
      handler: handleRecommendedEvent,
    },
    {
      id: 'latest-event',
      key: 'shift+l',
      description: 'Go to newest event matching filters',
      handler: handleLatestEvent,
    },
    {
      id: 'oldest-event',
      key: 'shift+h',
      description: 'Go to earliest event matching filters',
      handler: handleOldestEvent,
    },
  ]);
}
