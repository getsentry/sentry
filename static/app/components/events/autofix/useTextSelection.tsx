import {useCallback, useEffect, useState} from 'react';

interface TextSelection {
  referenceElement: HTMLElement | null;
  selectedText: string;
}

export function useTextSelection(containerRef: React.RefObject<HTMLElement>) {
  const [selection, setSelection] = useState<TextSelection | null>(null);

  const isClickInPopup = (target: HTMLElement) =>
    target.closest('[data-popup="autofix-highlight"]');

  const handleClick = useCallback(
    (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // If clicking in popup, do nothing
      if (isClickInPopup(target)) {
        return;
      }

      // Check if the click is within our container
      const isContainedWithin = containerRef.current?.contains(target);
      if (!isContainedWithin) {
        setSelection(null);
        return;
      }

      // Get the text content of the clicked element
      const clickedText = target.textContent?.trim() || '';
      if (!clickedText) {
        setSelection(null);
        return;
      }

      // Clear selection if clicking the same text
      if (selection?.referenceElement === target) {
        setSelection(null);
        return;
      }

      setSelection({
        selectedText: clickedText,
        referenceElement: target,
      });
    },
    [containerRef, selection]
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
    document.addEventListener('click', handleClick);
    document.addEventListener('mousedown', clearSelection);

    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('mousedown', clearSelection);
    };
  }, [handleClick, clearSelection]);

  return selection;
}
