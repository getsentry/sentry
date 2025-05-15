import {useEffect, useRef} from 'react';

function syncStyleAttr(element: HTMLElement, clientRect: DOMRect) {
  element.style.maxWidth = `${clientRect.width}px`;
}

interface UseConstrainListBoxWidthArgs {
  anyItemsShowing: boolean;
  isLoading: boolean;
  isOpen: boolean;
  referenceRef: React.RefObject<HTMLElement | null>;
  refsToSync: Array<React.RefObject<HTMLElement | null>>;
}

export function useConstrainListBoxWidth({
  anyItemsShowing,
  isLoading,
  isOpen,
  referenceRef,
  refsToSync,
}: UseConstrainListBoxWidthArgs) {
  const setInitialWidthRef = useRef(false);

  useEffect(() => {
    if (
      !referenceRef.current ||
      refsToSync.length === 0 ||
      !isOpen ||
      (!anyItemsShowing && !isLoading)
    ) {
      return undefined;
    }

    if (!setInitialWidthRef.current) {
      setInitialWidthRef.current = true;
      const clientRect = referenceRef.current.getBoundingClientRect();

      refsToSync.forEach(ref => {
        if (ref.current) {
          syncStyleAttr(ref.current, clientRect);
        }
      });
    }

    const observer = new ResizeObserver(entries => {
      const entry = entries?.[0];
      if (entry && refsToSync.every(ref => ref.current)) {
        const clientRect = entry.target.getBoundingClientRect();

        refsToSync.forEach(ref => {
          if (ref.current) {
            syncStyleAttr(ref.current, clientRect);
          }
        });
      }
    });

    observer.observe(referenceRef.current);

    return () => {
      observer.disconnect();
    };
  }, [anyItemsShowing, isLoading, isOpen, referenceRef, refsToSync]);
}
