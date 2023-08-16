import {RefObject, useCallback, useState} from 'react';
import {useResizeObserver} from '@react-aria/utils';

export type Dimensions = {height: number; width: number};

interface Props<Element extends HTMLElement> {
  elementRef: RefObject<Element>;
}

/**
 * Returns a ref to be added to an element and returns the dimensions of that element
 */
export function useDimensions<Element extends HTMLElement>({elementRef}: Props<Element>) {
  const [dimensions, setDimensions] = useState({height: 0, width: 0});

  const onResize = useCallback(() => {
    setDimensions({
      height: elementRef.current?.clientHeight || 0,
      width: elementRef.current?.clientWidth || 0,
    });
  }, [elementRef, setDimensions]);

  useResizeObserver({ref: elementRef, onResize});

  return {elementRef, ...dimensions};
}
