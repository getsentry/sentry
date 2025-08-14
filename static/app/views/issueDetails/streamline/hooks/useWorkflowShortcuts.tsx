import {useCallback} from 'react';

import {useComponentShortcuts} from 'sentry/utils/keyboardShortcuts';

interface UseWorkflowShortcutsProps {
  onFocusPriority?: () => void;
  onFocusAssignee?: () => void;
}

/**
 * Hook for workflow shortcuts (priority, assignee)
 * Use this in components that contain workflow selectors
 */
export function useWorkflowShortcuts({
  onFocusPriority,
  onFocusAssignee,
}: UseWorkflowShortcutsProps) {
  
  const handleFocusPriority = useCallback(() => {
    onFocusPriority?.();
  }, [onFocusPriority]);

  const handleFocusAssignee = useCallback(() => {
    onFocusAssignee?.();
  }, [onFocusAssignee]);

  useComponentShortcuts('issue-details-workflow', [
    {
      id: 'focus-priority',
      key: 'p',
      description: 'Focus Priority selector',
      handler: handleFocusPriority,
    },
    {
      id: 'focus-assignee',
      key: 'a',
      description: 'Focus Assignee selector',
      handler: handleFocusAssignee,
    },
  ]);
}