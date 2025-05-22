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
    if (!baseRef.current || !targetRef.current) {
      return undefined;
    }

    // we want a resize observer to watch for any resizing events so that we can update the width of the target element
    const resize = new ResizeObserver(entries => {
      entries.forEach(entry => {
        if (targetRef.current && entry) {
          targetRef.current.style.width = `${entry.target.scrollWidth}px`;
        }
      });
    });

    resize.observe(baseRef.current);

    return () => {
      resize.disconnect();
    };
  }, [baseRef, targetRef]);
};
