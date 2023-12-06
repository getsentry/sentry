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
  const window = windowRef.current;
  const content = contentRef.current;

  const [scrollPosition, setScrollPosition] = useState({
    offsetX: 0,
    offsetY: 0,
  });

  const reclamp = useCallback(() => {
    if (!window) {
      return;
    }
    setScrollPosition(prev => {
      const minX =
        (content?.clientWidth ?? Number.MAX_SAFE_INTEGER) * -1 + window.clientWidth;
      const minY =
        (content?.clientHeight ?? Number.MAX_SAFE_INTEGER) * -1 + window.clientHeight;
      const offsetX = clamp(prev.offsetX, minX, 0);
      const offsetY = clamp(prev.offsetY, minY, 0);
      return {offsetX, offsetY};
    });
  }, [content, window]);

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
  }, [content, window]);

  return {
    ...scrollPosition,
    reclamp,
  };
}
