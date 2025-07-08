import {useEffect} from 'react';

import type {Block} from 'sentry/views/seerExplorer/types';

interface UseBlockNavigationProps {
  blockRefs: {current: Array<HTMLDivElement | null>};
  blocks: Block[];
  focusedBlockIndex: number;
  isOpen: boolean;
  setFocusedBlockIndex: (index: number) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
}

export function useBlockNavigation({
  isOpen,
  focusedBlockIndex,
  blocks,
  blockRefs,
  textareaRef,
  setFocusedBlockIndex,
}: UseBlockNavigationProps) {
  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (focusedBlockIndex === -1) {
          // Move from input to last block
          const newIndex = blocks.length - 1;
          setFocusedBlockIndex(newIndex);
          blockRefs.current[newIndex]?.scrollIntoView({block: 'nearest'});
        } else if (focusedBlockIndex > 0) {
          // Move up in blocks
          const newIndex = focusedBlockIndex - 1;
          setFocusedBlockIndex(newIndex);
          blockRefs.current[newIndex]?.scrollIntoView({block: 'nearest'});
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (focusedBlockIndex === -1) {
          // Already at input, do nothing
          return;
        }
        if (focusedBlockIndex < blocks.length - 1) {
          // Move down in blocks
          const newIndex = focusedBlockIndex + 1;
          setFocusedBlockIndex(newIndex);
          blockRefs.current[newIndex]?.scrollIntoView({block: 'nearest'});
        } else {
          // Move from last block to input
          setFocusedBlockIndex(-1);
          textareaRef.current?.focus();
          textareaRef.current?.scrollIntoView({block: 'nearest'});
        }
      } else if (e.key === 'Tab') {
        e.preventDefault();
        // Tab always returns to input and focuses textarea
        setFocusedBlockIndex(-1);
        textareaRef.current?.focus();
        textareaRef.current?.scrollIntoView({block: 'nearest'});
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
  ]);
}
