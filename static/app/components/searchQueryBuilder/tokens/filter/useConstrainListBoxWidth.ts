import {useEffect, useRef} from 'react';

function syncStyleAttr(element: HTMLElement, referenceRect: DOMRect) {
  element.style.maxWidth = `${referenceRect.width}px`;
}

function alignPopover(popoverElement: HTMLElement, referenceRect: DOMRect) {
  const popoverRect = popoverElement.getBoundingClientRect();
  const parentOfTarget = popoverElement.offsetParent || document.documentElement;
  const parentRect = parentOfTarget.getBoundingClientRect();

  const sourceCenterViewport = referenceRect.left + referenceRect.width / 2;
  const desiredTargetLeftViewport = sourceCenterViewport - popoverRect.width / 2;
  const newX = desiredTargetLeftViewport - parentRect.left;
  popoverElement.style.left = `${newX}px`;
}

interface UseConstrainListBoxWidthArgs {
  anyItemsShowing: boolean;
  isLoading: boolean;
  isOpen: boolean;
  popoverRef: React.RefObject<HTMLElement | null>;
  referenceRef: React.RefObject<HTMLElement | null>;
  refsToSync: Array<React.RefObject<HTMLElement | null>>;
}

export function useConstrainListBoxWidth({
  anyItemsShowing,
  isLoading,
  isOpen,
  popoverRef,
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
      if (!popoverRef.current) {
        return undefined;
      }

      const referenceRect = referenceRef.current.getBoundingClientRect();
      const popoverRect = popoverRef.current.getBoundingClientRect();

      if (popoverRect.width === referenceRect.width) {
        alignPopover(popoverRef.current, referenceRect);
      } else {
        popoverRef.current.style.left = 'auto';
      }

      refsToSync.forEach(ref => {
        if (ref.current) {
          syncStyleAttr(ref.current, referenceRect);
        }
      });
    }

    const observer = new ResizeObserver(entries => {
      const entry = entries?.[0];
      if (entry && refsToSync.every(ref => ref.current)) {
        if (!popoverRef.current) {
          return undefined;
        }

        const referenceRect = entry.target.getBoundingClientRect();
        const popoverRect = popoverRef.current.getBoundingClientRect();

        if (popoverRect.width === referenceRect.width) {
          alignPopover(popoverRef.current, referenceRect);
        } else {
          popoverRef.current.style.left = 'auto';
        }

        refsToSync.forEach(ref => {
          if (ref.current) {
            syncStyleAttr(ref.current, referenceRect);
          }
        });
      }

      return undefined;
    });

    observer.observe(referenceRef.current);

    return () => {
      observer.disconnect();
    };
  }, [anyItemsShowing, isLoading, isOpen, popoverRef, referenceRef, refsToSync]);
}
