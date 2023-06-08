import {useCallback, useRef, useState} from 'react';
import {useResizeObserver} from '@react-aria/utils';

/**
 * Returns a ref to be added to an element and returns the dimensions of that element
 */
export function useDimensions<Element extends HTMLElement>() {
  const elementRef = useRef<Element>(null);
  const [dimensions, setDimensions] = useState({height: 0, width: 0});

  const onResize = useCallback(() => {
    setDimensions({
      height: elementRef.current?.clientHeight || 0,
      width: elementRef.current?.clientWidth || 0,
    });
  }, [setDimensions]);

  useResizeObserver({ref: elementRef, onResize});

  return {elementRef, ...dimensions};
}
