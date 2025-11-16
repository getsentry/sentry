import {useEffect, useRef} from 'react';

import type {Block} from 'sentry/views/seerExplorer/types';

interface UseBlockNavigationProps {
  blockRefs: {current: Array<HTMLDivElement | null>};
  blocks: Block[];
  focusedBlockIndex: number;
  isOpen: boolean;
  setFocusedBlockIndex: (index: number) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  isMinimized?: boolean;
  onDeleteFromIndex?: (index: number) => void;
  onKeyPress?: (blockIndex: number, key: 'Enter' | 'ArrowUp' | 'ArrowDown') => boolean;
  onNavigate?: () => void;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
}

function smoothScrollIntoView(
  element: HTMLElement,
  scrollContainer: HTMLElement | null,
  direction: 'up' | 'down' = 'down',
  lastScrollTimeRef: {current: number},
  pendingScrollFrameRef: {current: number | null}
) {
  if (!scrollContainer) {
    // Fallback to standard scrollIntoView if no container provided
    element.scrollIntoView({block: 'nearest', behavior: 'smooth'});
    return;
  }

  const containerRect = scrollContainer.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();

  const padding = 20;
  const containerTop = containerRect.top;
  const containerBottom = containerRect.bottom;
  const elementTop = elementRect.top;
  const elementBottom = elementRect.bottom;
  const elementHeight = elementRect.height;
  const containerHeight = containerRect.height;

  // Check if element is fully visible (both top and bottom within bounds with padding)
  const topVisible = elementTop >= containerTop + padding;
  const bottomVisible = elementBottom <= containerBottom - padding;
  const isFullyVisible = topVisible && bottomVisible;

  if (isFullyVisible) {
    // Element is already fully visible, no need to scroll
    return;
  }

  // Calculate scroll delta based on direction and visibility
  const isTallerThanViewport = elementHeight > containerHeight - padding * 2;
  const scrollDelta =
    direction === 'up'
      ? isTallerThanViewport || !topVisible
        ? elementTop - containerTop - padding
        : elementBottom - containerBottom + padding
      : isTallerThanViewport || !bottomVisible
        ? elementBottom - containerBottom + padding
        : elementTop - containerTop - padding;

  const targetScrollTop = scrollContainer.scrollTop + scrollDelta;

  // Ensure we don't scroll beyond container bounds
  const maxScroll = scrollContainer.scrollHeight - containerHeight;
  const clampedScrollTop = Math.max(0, Math.min(targetScrollTop, maxScroll));

  // Check if scrolling rapidly (within 100ms of last scroll)
  const now = Date.now();
  const timeSinceLastScroll = now - lastScrollTimeRef.current;
  const isRapidScrolling = timeSinceLastScroll < 100;

  // Cancel any pending scroll animation frame and batch scroll updates
  if (pendingScrollFrameRef.current !== null) {
    cancelAnimationFrame(pendingScrollFrameRef.current);
  }

  pendingScrollFrameRef.current = requestAnimationFrame(() => {
    pendingScrollFrameRef.current = null;
    scrollContainer.scrollTo({
      top: clampedScrollTop,
      behavior: isRapidScrolling ? 'auto' : 'smooth',
    });
  });

  // Update last scroll time
  lastScrollTimeRef.current = now;
}

export function useBlockNavigation({
  isOpen,
  focusedBlockIndex,
  blocks,
  blockRefs,
  textareaRef,
  scrollContainerRef,
  setFocusedBlockIndex,
  isMinimized = false,
  onDeleteFromIndex,
  onKeyPress,
  onNavigate,
}: UseBlockNavigationProps) {
  // Track last scroll time to detect rapid scrolling
  const lastScrollTimeRef = useRef<number>(0);
  // Track pending scroll animation frame to cancel if needed
  const pendingScrollFrameRef = useRef<number | null>(null);

  // Handle keyboard navigation
  useEffect(() => {
    const scrollToElement = (
      element: HTMLElement | null,
      direction: 'up' | 'down' = 'down'
    ) => {
      if (!element) return;
      smoothScrollIntoView(
        element,
        scrollContainerRef?.current ?? null,
        direction,
        lastScrollTimeRef,
        pendingScrollFrameRef
      );
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        onNavigate?.();
        if (focusedBlockIndex === -1) {
          const newIndex = blocks.length - 1;
          const blockElement = blockRefs.current[newIndex];
          if (blockElement) {
            // Blur textarea when navigating to a block
            textareaRef.current?.blur();
            setFocusedBlockIndex(newIndex);
            scrollToElement(blockElement, 'down');
          }
        } else {
          const handled = onKeyPress?.(focusedBlockIndex, 'ArrowUp');
          if (!handled && focusedBlockIndex > 0) {
            const newIndex = focusedBlockIndex - 1;
            const blockElement = blockRefs.current[newIndex];
            if (blockElement) {
              setFocusedBlockIndex(newIndex);
              scrollToElement(blockElement, 'up');
            }
          }
        }
      } else if (e.key === 'ArrowDown') {
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
              scrollToElement(blockElement, 'down');
            }
          } else {
            setFocusedBlockIndex(-1);
            const textareaElement = textareaRef.current;
            if (textareaElement) {
              textareaElement.focus();
              scrollToElement(textareaElement, 'down');
            }
          }
        }
      } else if (e.key === 'Tab') {
        e.preventDefault();
        onNavigate?.();
        if (isMinimized && focusedBlockIndex >= 0 && focusedBlockIndex < blocks.length) {
          scrollToElement(blockRefs.current[focusedBlockIndex] ?? null, 'down');
        } else {
          setFocusedBlockIndex(-1);
          const textareaElement = textareaRef.current;
          if (textareaElement) {
            textareaElement.focus();
            scrollToElement(textareaElement, 'down');
          }
        }
      } else if (e.key === 'Backspace' && focusedBlockIndex >= 0) {
        e.preventDefault();
        onDeleteFromIndex?.(focusedBlockIndex);
        setFocusedBlockIndex(-1);
        const textareaElement = textareaRef.current;
        if (textareaElement) {
          textareaElement.focus();
          scrollToElement(textareaElement, 'down');
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
    scrollContainerRef,
    setFocusedBlockIndex,
    isMinimized,
    onDeleteFromIndex,
    onKeyPress,
    onNavigate,
  ]);
}
