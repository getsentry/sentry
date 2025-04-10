import {useLayoutEffect} from 'react';

type HtmlElementRef = React.RefObject<HTMLElement | null>;

/**
 * This hook syncs the total width of the base element with the width of the target
 * element.
 * @param baseRef - The ref of the base element.
 * @param targetRef - The ref of the target element.
 * @returns The total width of the base element.
 */
export const useSyncTotalWidth = (baseRef: HtmlElementRef, targetRef: HtmlElementRef) => {
  useLayoutEffect(() => {
    // if the text area or width div ref is not available, return
    if (!baseRef.current || !targetRef.current) {
      return undefined;
    }

    // create a resize observer to watch the text area for changes in width so once the text area is resized, the width div can be updated
    const resize = new ResizeObserver(entries => {
      entries.forEach(entry => {
        if (targetRef.current && entry) {
          targetRef.current.style.width = `${entry.target.scrollWidth}px`;
        }
      });
    });

    // observe the text area for changes
    resize.observe(baseRef.current);

    return () => {
      // disconnect the resize observer
      resize.disconnect();
    };
  }, [baseRef, targetRef]);
};
