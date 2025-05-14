import {useLayoutEffect, useState} from 'react';

/**
 * This hook gets the width of the wrapper element and syncs it with the width of the
 * content.
 * @returns The width of the wrapper element and setter for the wrapper ref.
 */
export const useSyncWrapperWidth = () => {
  const [wrapperWidth, setWrapperWidth] = useState<`${number}px` | '100%'>('100%');
  const [wrapperRefState, setWrapperRefState] = useState<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!wrapperRefState) {
      return undefined;
    }

    const resizeObserver = new ResizeObserver(entries => {
      const entry = entries?.[0];
      if (entry) {
        setWrapperWidth(`${entry.contentRect.width}px`);
      }
    });

    resizeObserver.observe(wrapperRefState);

    return () => {
      resizeObserver.disconnect();
    };
  }, [wrapperRefState]);

  return {
    wrapperWidth,
    setWrapperRefState,
  };
};
