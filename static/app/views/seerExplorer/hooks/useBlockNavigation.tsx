import {useEffect} from 'react';

import type {Block} from 'sentry/views/seerExplorer/types';

interface UseBlockNavigationProps {
  blockRefs: {current: Array<HTMLDivElement | null>};
  blocks: Block[];
  focusedBlockIndex: number;
  isOpen: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  isFileApprovalPending?: boolean;
  isMinimized?: boolean;
  isQuestionPending?: boolean;
  onKeyPress?: (blockIndex: number, key: 'Enter' | 'ArrowUp' | 'ArrowDown') => boolean;
  onNavigate?: () => void;
}

export function useBlockNavigation({
  isOpen,
  focusedBlockIndex,
  textareaRef,
  isFileApprovalPending = false,
  isQuestionPending = false,
  onKeyPress,
}: UseBlockNavigationProps) {
  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      // Disable when textarea is focused
      if (textareaRef.current === document.activeElement) {
        return;
      }

      // Don't handle Enter when file approval or question is pending (it's used for approve/submit)
      // or when the run is loading/polling
      if ((isFileApprovalPending || isQuestionPending) && e.key === 'Enter') {
        return;
      }

      if (e.key === 'Enter' && focusedBlockIndex >= 0) {
        e.preventDefault();
        onKeyPress?.(focusedBlockIndex, 'Enter');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    isOpen,
    focusedBlockIndex,
    textareaRef,
    isFileApprovalPending,
    isQuestionPending,
    onKeyPress,
  ]);
}
