import {useCallback, useEffect, useState} from 'react';

interface TextSelection {
  referenceElement: HTMLElement | null;
  selectedText: string;
}

export function useTextSelection(containerRef: React.RefObject<HTMLElement | null>) {
  const [selection, setSelection] = useState<TextSelection | null>(null);

  const isClickInPopup = (target: HTMLElement) =>
    target.closest('[data-popup="autofix-highlight"]');

  const shouldIgnoreElement = (target: HTMLElement) =>
    target.closest('[data-ignore-autofix-highlight="true"]');

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

      // Get the text content of the clicked element or its container
      const clickedText = containerRef.current?.textContent?.trim() || '';
      if (!clickedText) {
        setSelection(null);
        return;
      }

      // Clear selection if clicking within the same container while already selected
      if (selection?.referenceElement === containerRef.current) {
        setSelection(null);
        return;
      }

      // Use the containerRef as the reference element for positioning
      setSelection({
        selectedText: clickedText,
        referenceElement: containerRef.current,
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
