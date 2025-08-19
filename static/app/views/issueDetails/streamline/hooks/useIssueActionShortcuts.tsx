import {useCallback} from 'react';

import {useComponentShortcuts} from 'sentry/utils/keyboardShortcuts';

interface UseIssueActionShortcutsProps {
  onArchive?: () => void;
  onBookmark?: () => void;
  onDelete?: () => void;
  onMarkReviewed?: () => void;
  onResolve?: () => void;
  onShare?: () => void;
  onSubscribe?: () => void;
}

/**
 * Hook for issue action shortcuts (resolve, archive, etc.)
 * Use this in components that handle issue actions (like GroupActions)
 */
export function useIssueActionShortcuts({
  onResolve,
  onArchive,
  onSubscribe,
  onShare,
  onBookmark,
  onDelete,
  onMarkReviewed,
}: UseIssueActionShortcutsProps) {
  const handleResolve = useCallback(() => {
    onResolve?.();
  }, [onResolve]);

  const handleArchive = useCallback(() => {
    onArchive?.();
  }, [onArchive]);

  const handleSubscribe = useCallback(() => {
    onSubscribe?.();
  }, [onSubscribe]);

  const handleShare = useCallback(() => {
    onShare?.();
  }, [onShare]);

  const handleBookmark = useCallback(() => {
    onBookmark?.();
  }, [onBookmark]);

  const handleMarkReviewed = useCallback(() => {
    onMarkReviewed?.();
  }, [onMarkReviewed]);

  const handleDelete = useCallback(() => {
    onDelete?.();
  }, [onDelete]);

  useComponentShortcuts('issue-details-actions', [
    {
      id: 'resolve-issue',
      key: 'r',
      description: 'Resolve issue',
      handler: handleResolve,
    },
    {
      id: 'archive-issue',
      key: 'i',
      description: 'Archive issue',
      handler: handleArchive,
    },
    {
      id: 'subscribe-issue',
      key: 's',
      description: 'Subscribe/unsubscribe',
      handler: handleSubscribe,
    },
    {
      id: 'share-issue',
      key: 'u',
      description: 'Share issue',
      handler: handleShare,
    },
    {
      id: 'bookmark-issue',
      key: 'b',
      description: 'Bookmark/unbookmark issue',
      handler: handleBookmark,
    },
    {
      id: 'mark-reviewed',
      key: 'v',
      description: 'Mark as reviewed',
      handler: handleMarkReviewed,
    },
    {
      id: 'delete-issue',
      key: 'd',
      description: 'Delete issue',
      handler: handleDelete,
    },
  ]);
}
