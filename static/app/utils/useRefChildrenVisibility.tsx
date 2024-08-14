import {useEffect, useState} from 'react';

interface UseRefChildrenVisibilityOptions {
  children: React.ReactNode;
  /**
   * Ref to the scroll container.
   */
  scrollContainerRef: React.MutableRefObject<HTMLElement | null>;
  visibleRatio: number;
}

/**
 * Determine the visibility of children elements within a scroll container.
 */
export function useRefChildrenVisibility({
  children,
  scrollContainerRef,
  visibleRatio,
}: UseRefChildrenVisibilityOptions) {
  // The visibility match up to the elements list. Visibility of elements is
  // true if visible in the scroll container, false if outside.
  const [childrenEls, setChildrenEls] = useState<HTMLElement[]>([]);
  const [visibility, setVisibility] = useState<boolean[]>([]);

  // Update list of children element
  useEffect(
    () =>
      setChildrenEls(
        Array.from(scrollContainerRef.current?.children ?? []) as HTMLElement[]
      ),
    [children, scrollContainerRef]
  );

  // Update the threshold list. This
  useEffect(() => {
    if (!scrollContainerRef.current) {
      return () => {};
    }

    const observer = new IntersectionObserver(
      entries =>
        setVisibility(currentVisibility =>
          // Compute visibility list of the elements
          childrenEls.map((child, idx) => {
            const entry = entries.find(e => e.target === child);

            // NOTE: When the intersection observer fires, only elements that
            // have passed a threshold will be included in the entries list.
            // This is why we fallback to the currentThreshold value if there
            // was no entry for the child.
            return entry !== undefined
              ? entry.intersectionRatio > visibleRatio
              : currentVisibility[idx] ?? false;
          })
        ),
      {
        root: scrollContainerRef.current,
        threshold: [visibleRatio],
      }
    );

    childrenEls.map(child => observer.observe(child));

    return () => observer.disconnect();
  }, [childrenEls, visibleRatio, scrollContainerRef]);

  return {childrenEls, visibility};
}
