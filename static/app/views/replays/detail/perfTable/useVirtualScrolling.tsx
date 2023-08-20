import {RefObject, useCallback, useEffect, useState} from 'react';

import clamp from 'sentry/utils/number/clamp';

interface Props<Element extends HTMLElement> {
  contentRef: RefObject<Element>;
  windowRef: RefObject<Element>;
}

export default function useVirtualScrolling<Element extends HTMLElement>({
  contentRef,
  windowRef,
}: Props<Element>) {
  const [scrollPosition, setScrollPosition] = useState({
    offsetX: 0,
    offsetY: 0,
  });

  const reset = useCallback(() => {
    setScrollPosition({
      offsetX: 0,
      offsetY: 0,
    });
  }, []);

  const window = windowRef.current;
  const content = contentRef.current;

  useEffect(() => {
    if (!window) {
      return () => {};
    }

    const handleWheel = (e: WheelEvent) => {
      const {deltaX, deltaY} = e;

      setScrollPosition(prev => {
        const minX =
          (content?.clientWidth ?? Number.MAX_SAFE_INTEGER) * -1 + window.clientWidth;
        const minY =
          (content?.clientHeight ?? Number.MAX_SAFE_INTEGER) * -1 + window.clientHeight;
        const offsetX = clamp(prev.offsetX - deltaX, minX, 0);
        const offsetY = clamp(prev.offsetY - deltaY, minY, 0);
        return {offsetX, offsetY};
      });
    };

    window.addEventListener('wheel', handleWheel);
    return () => {
      window.removeEventListener('wheel', handleWheel);
    };
  }, [window, content]);

  return {
    ...scrollPosition,
    reset,
  };
}
