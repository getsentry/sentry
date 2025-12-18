import {useEffect} from 'react';

import type {Block} from 'sentry/views/seerExplorer/types';

interface UseBlockNavigationProps {
  blockRefs: {current: Array<HTMLDivElement | null>};
  blocks: Block[];
  focusedBlockIndex: number;
  isOpen: boolean;
  setFocusedBlockIndex: (index: number) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  isFileApprovalPending?: boolean;
  isMinimized?: boolean;
  isPolling?: boolean;
  isQuestionPending?: boolean;
  onDeleteFromIndex?: (index: number) => void;
  onKeyPress?: (blockIndex: number, key: 'Enter' | 'ArrowUp' | 'ArrowDown') => boolean;
  onNavigate?: () => void;
}

export function useBlockNavigation({
  isOpen,
  focusedBlockIndex,
  blocks,
  blockRefs,
  textareaRef,
  setFocusedBlockIndex,
  isFileApprovalPending = false,
  isMinimized = false,
  isPolling = false,
  isQuestionPending = false,
  onDeleteFromIndex,
  onKeyPress,
  onNavigate,
}: UseBlockNavigationProps) {
  // Handle keyboard navigation
  useEffect(() => {
    const scrollToElement = (element: HTMLElement | null) => {
      if (!element) return;
      element.scrollIntoView({block: 'nearest', behavior: 'smooth'});
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      // Don't handle Enter when file approval or question is pending (it's used for approve/submit)
      // or when the run is loading/polling
      if (
        (isFileApprovalPending || isQuestionPending || isPolling) &&
        e.key === 'Enter'
      ) {
        return;
      }

      if (e.key === 'ArrowUp') {
        if (isMinimized) return;
        e.preventDefault();
        onNavigate?.();
        if (focusedBlockIndex === -1) {
          const newIndex = blocks.length - 1;
          const blockElement = blockRefs.current[newIndex];
          if (blockElement) {
            // Blur textarea when navigating to a block
            textareaRef.current?.blur();
            setFocusedBlockIndex(newIndex);
            scrollToElement(blockElement);
          }
        } else {
          const handled = onKeyPress?.(focusedBlockIndex, 'ArrowUp');
          if (!handled && focusedBlockIndex > 0) {
            const newIndex = focusedBlockIndex - 1;
            const blockElement = blockRefs.current[newIndex];
            if (blockElement) {
              setFocusedBlockIndex(newIndex);
              scrollToElement(blockElement);
            }
          }
        }
      } else if (e.key === 'ArrowDown') {
        if (isMinimized) return;
        e.preventDefault();
        if (focusedBlockIndex === -1) return;
        onNavigate?.();
        const handled = onKeyPress?.(focusedBlockIndex, 'ArrowDown');
        if (!handled) {
          if (focusedBlockIndex < blocks.length - 1) {
            const newIndex = focusedBlockIndex + 1;
            const blockElement = blockRefs.current[newIndex];
            if (blockElement) {
              setFocusedBlockIndex(newIndex);
              scrollToElement(blockElement);
            }
          } else {
            setFocusedBlockIndex(-1);
            const textareaElement = textareaRef.current;
            if (textareaElement) {
              textareaElement.focus();
              scrollToElement(textareaElement);
            }
          }
        }
      } else if (e.key === 'Tab') {
        e.preventDefault();
        onNavigate?.();
        if (isMinimized && focusedBlockIndex >= 0 && focusedBlockIndex < blocks.length) {
          scrollToElement(blockRefs.current[focusedBlockIndex] ?? null);
        } else {
          setFocusedBlockIndex(-1);
          const textareaElement = textareaRef.current;
          if (textareaElement) {
            textareaElement.focus();
            scrollToElement(textareaElement);
          }
        }
      } else if (e.key === 'Enter' && focusedBlockIndex >= 0) {
        e.preventDefault();
        onKeyPress?.(focusedBlockIndex, 'Enter');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    isOpen,
    focusedBlockIndex,
    blocks.length,
    blockRefs,
    textareaRef,
    setFocusedBlockIndex,
    isFileApprovalPending,
    isMinimized,
    isPolling,
    isQuestionPending,
    onDeleteFromIndex,
    onKeyPress,
    onNavigate,
  ]);
}
