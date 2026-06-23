import type {RefObject} from 'react';
import {useLayoutEffect, useState} from 'react';

import {getOffsetRect} from 'sentry/utils/getOffsetRect';

interface ElementOffset {
  left: number;
  top: number;
}

/**
 * Returns the offset of an element relative to another element (e.g. an
 * element's top edge relative to a container). The offset is re-measured via a
 * ResizeObserver on both elements, so it stays correct as either element
 * resizes. Both elements are expected to be mounted while the hook is in use.
 */
export function useElementOffset(
  elementRef: RefObject<HTMLElement | null>,
  relativeToRef: RefObject<HTMLElement | null>
): ElementOffset {
  const [offset, setOffset] = useState({left: 0, top: 0});

  useLayoutEffect(() => {
    const element = elementRef.current;
    const relativeTo = relativeToRef.current;
    if (!element || !relativeTo) {
      return () => {};
    }

    const measure = () => {
      const {left, top} = getOffsetRect(element, relativeTo);
      setOffset({left, top});
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    observer.observe(relativeTo);
    return () => observer.disconnect();
  }, [elementRef, relativeToRef]);

  return offset;
}
