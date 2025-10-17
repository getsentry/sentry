import {useEffect} from 'react';

import type {Block} from 'sentry/views/seerExplorer/types';

interface UseBlockNavigationProps {
  blockRefs: {current: Array<HTMLDivElement | null>};
  blocks: Block[];
  focusedBlockIndex: number;
  isOpen: boolean;
  setFocusedBlockIndex: (index: number) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
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
  onDeleteFromIndex,
  onKeyPress,
  onNavigate,
}: UseBlockNavigationProps) {
  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        onNavigate?.();
        if (focusedBlockIndex === -1) {
          // Move from input to last block
          const newIndex = blocks.length - 1;
          setFocusedBlockIndex(newIndex);
          blockRefs.current[newIndex]?.scrollIntoView({block: 'nearest'});
        } else {
          // Try to let the block handle it first (for cycling through links)
          const handled = onKeyPress?.(focusedBlockIndex, 'ArrowUp');
          if (!handled && focusedBlockIndex > 0) {
            // Block didn't handle it, move up in blocks
            const newIndex = focusedBlockIndex - 1;
            setFocusedBlockIndex(newIndex);
            blockRefs.current[newIndex]?.scrollIntoView({block: 'nearest'});
          }
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (focusedBlockIndex === -1) {
          // Already at input, do nothing
          return;
        }
        onNavigate?.();
        // Try to let the block handle it first (for cycling through links)
        const handled = onKeyPress?.(focusedBlockIndex, 'ArrowDown');
        if (!handled) {
          // Block didn't handle it, do block navigation
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
        }
      } else if (e.key === 'Tab') {
        e.preventDefault();
        onNavigate?.();
        // Tab always returns to input and focuses textarea
        setFocusedBlockIndex(-1);
        textareaRef.current?.focus();
        textareaRef.current?.scrollIntoView({block: 'nearest'});
      } else if (e.key === 'Backspace' && focusedBlockIndex >= 0) {
        e.preventDefault();
        // Delete from this block and all blocks after it
        onDeleteFromIndex?.(focusedBlockIndex);
        // Focus returns to input
        setFocusedBlockIndex(-1);
        textareaRef.current?.focus();
        textareaRef.current?.scrollIntoView({block: 'nearest'});
      } else if (e.key === 'Enter' && focusedBlockIndex >= 0) {
        e.preventDefault();
        // Handle Enter key on focused block
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
    onDeleteFromIndex,
    onKeyPress,
    onNavigate,
  ]);
}
