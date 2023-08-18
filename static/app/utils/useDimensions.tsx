import {RefObject, useCallback, useState} from 'react';
import {useResizeObserver} from '@react-aria/utils';

interface Props<Element extends HTMLElement> {
  elementRef: RefObject<Element>;
}

/**
 * Returns a ref to be added to an element and returns the dimensions of that element
 */
export function useDimensions<Element extends HTMLElement>({elementRef}: Props<Element>) {
  const [dimensions, setDimensions] = useState({height: 0, width: 0});

  const element = elementRef.current;

  const onResize = useCallback(() => {
    setDimensions({
      height: element?.clientHeight || 0,
      width: element?.clientWidth || 0,
    });
  }, [element]);

  useResizeObserver({ref: elementRef, onResize});

  return dimensions;
}
