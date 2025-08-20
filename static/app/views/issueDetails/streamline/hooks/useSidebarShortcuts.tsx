import {useCallback} from 'react';

import {useComponentShortcuts} from 'sentry/utils/keyboardShortcuts';

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
  const handleFocusComment = useCallback(() => {
    onFocusComment?.();
  }, [onFocusComment]);

  useComponentShortcuts(
    'issue-details-general',
    disabled
      ? []
      : [
          {
            id: 'focus-comment',
            key: 'c',
            description: 'Focus comment input',
            handler: handleFocusComment,
          },
        ]
  );
}
