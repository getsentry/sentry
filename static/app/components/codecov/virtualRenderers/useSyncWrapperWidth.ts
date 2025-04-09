import {useLayoutEffect, useState} from 'react';

export const useSyncWrapperWidth = () => {
  const [wrapperWidth, setWrapperWidth] = useState<number | '100%'>('100%');
  const [wrapperRefState, setWrapperRefState] = useState<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!wrapperRefState) {
      return undefined;
    }

    const resizeObserver = new ResizeObserver(entries => {
      const entry = entries?.[0];
      if (entry) {
        setWrapperWidth(entry.contentRect.width);
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
