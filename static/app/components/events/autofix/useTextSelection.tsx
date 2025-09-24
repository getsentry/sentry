import {useCallback, useEffect, useState} from 'react';

interface TextSelection {
  isRangeSelection: boolean;
  referenceElement: HTMLElement | null;
  selectedText: string;
}

export function useTextSelection(containerRef: React.RefObject<HTMLElement | null>) {
  const [selection, setSelection] = useState<TextSelection | null>(null);

  const isClickInPopup = (target: HTMLElement) =>
    target.closest('[data-popup="autofix-highlight"]');

  const shouldIgnoreElement = (target: HTMLElement) =>
    target.closest('[data-ignore-autofix-highlight="true"]');

  const getSelectedTextWithinContainer = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return '';
    }
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      return '';
    }
    const anchorNode = sel.anchorNode;
    const focusNode = sel.focusNode;
    if (!anchorNode || !focusNode) {
      return '';
    }

    const isNodeInside = (node: Node) => {
      const element =
        node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
      return !!element && container.contains(element);
    };

    // Only treat as a valid selection if both endpoints are within our container
    if (!isNodeInside(anchorNode) || !isNodeInside(focusNode)) {
      return '';
    }

    return sel.toString().trim();
  }, [containerRef]);

  const handleMouseUp = useCallback(
    (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // Ignore interactions with the popup or explicitly ignored elements
      if (isClickInPopup(target) || shouldIgnoreElement(target)) {
        return;
      }

      // Only react to mouseup inside the container
      if (!containerRef.current?.contains(target)) {
        return;
      }

      const selected = getSelectedTextWithinContainer();
      if (selected) {
        setSelection({
          selectedText: selected,
          referenceElement: containerRef.current,
          isRangeSelection: true,
        });
      }
    },
    [containerRef, getSelectedTextWithinContainer]
  );

  const handleClick = useCallback(
    (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // If clicking in popup, do nothing
      if (isClickInPopup(target)) {
        return;
      }

      // If clicking in an ignored element, do nothing
      if (shouldIgnoreElement(target)) {
        return;
      }

      // Check if the click is within our container
      const isContainedWithin = containerRef.current?.contains(target);
      if (!isContainedWithin) {
        setSelection(null);
        return;
      }

      // If there is an actual user text selection inside the container, prefer that
      const currentUserSelection = getSelectedTextWithinContainer();
      if (currentUserSelection) {
        setSelection({
          selectedText: currentUserSelection,
          referenceElement: containerRef.current!,
          isRangeSelection: true,
        });
        return;
      }

      // If clicking within the same container while already selected (and no range selection), toggle off
      if (selection?.referenceElement === containerRef.current) {
        setSelection(null);
        return;
      }

      // Otherwise treat it as a simple click-to-open
      const clickedText = containerRef.current?.textContent?.trim() || '';
      if (!clickedText) {
        setSelection(null);
        return;
      }

      setSelection({
        selectedText: clickedText,
        referenceElement: containerRef.current!,
        isRangeSelection: false,
      });
    },
    [containerRef, selection, getSelectedTextWithinContainer]
  );

  const clearSelection = useCallback(
    (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // Don't clear if clicking within the popup
      if (isClickInPopup(target)) {
        return;
      }

      // Don't clear if clicking the original container that triggered the popup
      if (containerRef.current?.contains(target)) {
        return;
      }

      setSelection(null);
    },
    [containerRef]
  );

  useEffect(() => {
    document.addEventListener('click', handleClick, true);
    document.addEventListener('mouseup', handleMouseUp, true);
    document.addEventListener('mousedown', clearSelection);

    return () => {
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('mouseup', handleMouseUp, true);
      document.removeEventListener('mousedown', clearSelection);
    };
  }, [handleClick, handleMouseUp, clearSelection]);

  return selection;
}
