import {useCallback} from 'react';

import {useComponentShortcuts} from 'sentry/utils/keyboardShortcuts';
import {useLocation} from 'sentry/utils/useLocation';

interface UseSidebarShortcutsProps {
  disabled?: boolean;
  onFocusComment?: () => void;
}

/**
 * Hook for sidebar shortcuts
 * Use this in components that handle sidebar actions (like StreamlinedSidebar)
 */
export function useSidebarShortcuts({
  onFocusComment,
  disabled,
}: UseSidebarShortcutsProps) {
  const location = useLocation();

  // Only register shortcuts when on issue details pages
  const isOnIssueDetailsPage =
    location.pathname.includes('/issues/') &&
    (location.pathname.includes('/events/') || location.pathname.endsWith('/'));
  const shouldRegisterShortcuts = isOnIssueDetailsPage && !disabled;

  const handleFocusComment = useCallback(() => {
    onFocusComment?.();
  }, [onFocusComment]);

  useComponentShortcuts(
    'issue-details-sidebar',
    shouldRegisterShortcuts
      ? [
          {
            id: 'focus-comment',
            key: 'c',
            description: 'Focus comment input',
            handler: handleFocusComment,
          },
        ]
      : []
  );
}
