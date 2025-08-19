import {useCallback, useMemo} from 'react';

import {useComponentShortcuts, useShortcuts} from 'sentry/utils/keyboardShortcuts';
import {
  getSequenceInitializerKeysFromShortcuts,
  SEQUENCE_INITIALIZER_KEYS,
} from 'sentry/utils/keyboardShortcuts/sequenceInitializers';

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
  const {activeShortcuts} = useShortcuts();

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

  const shortcuts = useMemo(() => {
    const allShortcuts = [
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
        description: 'Toggle subscription to workflow notifications for this issue',
        handler: handleSubscribe,
      },
      {
        id: 'share-issue',
        key: 'shift+s',
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
    ];

    // Only block sequence initializer keys (like 't'), not all sequence keys
    const sequenceInitializers = getSequenceInitializerKeysFromShortcuts(activeShortcuts);
    const allSequenceInitializers = new Set([
      ...SEQUENCE_INITIALIZER_KEYS,
      ...sequenceInitializers,
    ]);

    // Filter out shortcuts that conflict with sequence initializers only
    return allShortcuts.filter(shortcut => {
      // Don't register single-key shortcuts that are sequence initializers
      const key = Array.isArray(shortcut.key) ? shortcut.key[0] : shortcut.key;
      const keyParts = key.split(' ');

      if (keyParts.length === 1 && allSequenceInitializers.has(key)) {
        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.log(
            `🚫 Skipping shortcut "${shortcut.id}" (${key}) due to sequence initializer conflict`
          );
        }
        return false;
      }

      return true;
    });
  }, [
    handleResolve,
    handleArchive,
    handleSubscribe,
    handleShare,
    handleBookmark,
    handleMarkReviewed,
    handleDelete,
    activeShortcuts,
  ]);

  useComponentShortcuts('issue-details-actions', shortcuts);
}
